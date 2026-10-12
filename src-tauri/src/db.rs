//! SQLite storage: schema, migrations, CRUD, full-text search.

use crate::parser::{ParsedNote, Status};
use chrono::{Local, NaiveDate};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub type Result<T> = std::result::Result<T, String>;

pub fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

const MIGRATIONS: &[&str] = &[r#"
CREATE TABLE notes (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('todo','ongoing','pending','done')),
  position INTEGER NOT NULL DEFAULT 0,
  needs_review INTEGER NOT NULL DEFAULT 0,
  review_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  done_at TEXT,
  due_at TEXT,
  source_line INTEGER
);
CREATE INDEX notes_status_pos ON notes(status, position);

CREATE TABLE checklist_items (
  id INTEGER PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX checklist_note ON checklist_items(note_id, position);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color TEXT NOT NULL
);

CREATE TABLE note_tags (
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

CREATE TABLE reminder_log (
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  due_at TEXT NOT NULL,
  PRIMARY KEY (note_id, kind, due_at)
);

CREATE VIRTUAL TABLE notes_fts USING fts5(
  title, body, content='notes', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;
CREATE TRIGGER notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
END;
CREATE TRIGGER notes_au AFTER UPDATE OF title, body ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
  INSERT INTO notes_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;
"#];

/// Default colors for the keyword tags, then a palette for user-made tags.
const TAG_COLORS: &[(&str, &str)] = &[
    ("approval", "#3f9f7f"),
    ("erp", "#5b8def"),
    ("recruitment", "#d0893f"),
    ("web", "#c2607a"),
    ("infra", "#7c8a9a"),
    ("riset", "#b59a3b"),
    ("tim", "#4fa3b8"),
];
const PALETTE: &[&str] = &["#3f9f7f", "#5b8def", "#d0893f", "#c2607a", "#7c8a9a", "#b59a3b", "#4fa3b8", "#8f7a66"];

pub fn now() -> String {
    Local::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

pub fn open(path: &std::path::Path) -> Result<Connection> {
    let conn = Connection::open(path).map_err(err)?;
    init(conn)
}

pub fn open_in_memory() -> Result<Connection> {
    init(Connection::open_in_memory().map_err(err)?)
}

fn init(conn: Connection) -> Result<Connection> {
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL;")
        .map_err(err)?;
    let version: usize = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).map_err(err)?;
    for (i, sql) in MIGRATIONS.iter().enumerate().skip(version) {
        conn.execute_batch(&format!("BEGIN; {sql}; PRAGMA user_version = {}; COMMIT;", i + 1))
            .map_err(err)?;
    }
    Ok(conn)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ChecklistItem {
    #[serde(default)]
    pub id: Option<i64>,
    pub text: String,
    pub done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: i64,
    pub title: String,
    pub body: String,
    pub status: Status,
    pub position: i64,
    pub needs_review: bool,
    pub review_reason: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub done_at: Option<String>,
    pub due_at: Option<String>,
    pub source_line: Option<u32>,
    pub tags: Vec<String>,
    pub checklist: Vec<ChecklistItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteInput {
    pub id: Option<i64>,
    pub title: String,
    #[serde(default)]
    pub body: String,
    pub status: Status,
    #[serde(default)]
    pub needs_review: bool,
    #[serde(default)]
    pub due_at: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub checklist: Vec<ChecklistItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Tag {
    pub id: i64,
    pub name: String,
    pub color: String,
}

fn default_color(name: &str) -> String {
    let lower = name.to_lowercase();
    if let Some((_, c)) = TAG_COLORS.iter().find(|(n, _)| *n == lower) {
        return c.to_string();
    }
    let h = lower.bytes().fold(7u32, |a, b| a.wrapping_mul(31).wrapping_add(b as u32));
    PALETTE[h as usize % PALETTE.len()].to_string()
}

fn ensure_tag(conn: &Connection, name: &str) -> Result<i64> {
    let name = name.trim();
    if let Some(id) = conn
        .query_row("SELECT id FROM tags WHERE name = ?1", [name], |r| r.get(0))
        .optional()
        .map_err(err)?
    {
        return Ok(id);
    }
    conn.execute("INSERT INTO tags(name, color) VALUES (?1, ?2)", params![name, default_color(name)])
        .map_err(err)?;
    Ok(conn.last_insert_rowid())
}

fn set_tags(conn: &Connection, note_id: i64, tags: &[String]) -> Result<()> {
    conn.execute("DELETE FROM note_tags WHERE note_id = ?1", [note_id]).map_err(err)?;
    for t in tags.iter().filter(|t| !t.trim().is_empty()) {
        let tag_id = ensure_tag(conn, t)?;
        conn.execute(
            "INSERT OR IGNORE INTO note_tags(note_id, tag_id) VALUES (?1, ?2)",
            params![note_id, tag_id],
        )
        .map_err(err)?;
    }
    Ok(())
}

fn set_checklist(conn: &Connection, note_id: i64, items: &[ChecklistItem]) -> Result<()> {
    conn.execute("DELETE FROM checklist_items WHERE note_id = ?1", [note_id]).map_err(err)?;
    for (i, it) in items.iter().enumerate() {
        conn.execute(
            "INSERT INTO checklist_items(note_id, text, done, position) VALUES (?1, ?2, ?3, ?4)",
            params![note_id, it.text, it.done, i as i64],
        )
        .map_err(err)?;
    }
    Ok(())
}

pub fn list_tags(conn: &Connection) -> Result<Vec<Tag>> {
    let mut st = conn.prepare("SELECT id, name, color FROM tags ORDER BY name").map_err(err)?;
    let rows = st
        .query_map([], |r| Ok(Tag { id: r.get(0)?, name: r.get(1)?, color: r.get(2)? }))
        .map_err(err)?;
    rows.collect::<std::result::Result<_, _>>().map_err(err)
}

pub fn update_tag(conn: &Connection, id: i64, name: &str, color: &str) -> Result<()> {
    if name.trim().is_empty() {
        return Err("Nama tag tidak boleh kosong".into());
    }
    conn.execute("UPDATE tags SET name = ?2, color = ?3 WHERE id = ?1", params![id, name.trim(), color])
        .map_err(|e| if e.to_string().contains("UNIQUE") { "Nama tag sudah dipakai".into() } else { err(e) })?;
    Ok(())
}

pub fn delete_tag(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM tags WHERE id = ?1", [id]).map_err(err)?;
    Ok(())
}

const NOTE_COLS: &str = "id, title, body, status, position, needs_review, review_reason, created_at, updated_at, done_at, due_at, source_line";

fn row_to_note(r: &rusqlite::Row) -> rusqlite::Result<Note> {
    let status: String = r.get(3)?;
    Ok(Note {
        id: r.get(0)?,
        title: r.get(1)?,
        body: r.get(2)?,
        status: Status::parse(&status).unwrap_or(Status::Todo),
        position: r.get(4)?,
        needs_review: r.get(5)?,
        review_reason: r.get(6)?,
        created_at: r.get(7)?,
        updated_at: r.get(8)?,
        done_at: r.get(9)?,
        due_at: r.get(10)?,
        source_line: r.get(11)?,
        tags: vec![],
        checklist: vec![],
    })
}

/// Loads every note with its tags and checklist, ordered by column then position.
pub fn list_notes(conn: &Connection) -> Result<Vec<Note>> {
    let mut st = conn
        .prepare(&format!("SELECT {NOTE_COLS} FROM notes ORDER BY status, position, id"))
        .map_err(err)?;
    let mut notes: Vec<Note> = st
        .query_map([], row_to_note)
        .map_err(err)?
        .collect::<std::result::Result<_, _>>()
        .map_err(err)?;
    let index: HashMap<i64, usize> = notes.iter().enumerate().map(|(i, n)| (n.id, i)).collect();

    let mut st = conn
        .prepare("SELECT nt.note_id, t.name FROM note_tags nt JOIN tags t ON t.id = nt.tag_id ORDER BY t.name")
        .map_err(err)?;
    let mut rows = st.query([]).map_err(err)?;
    while let Some(r) = rows.next().map_err(err)? {
        let id: i64 = r.get(0).map_err(err)?;
        if let Some(&i) = index.get(&id) {
            notes[i].tags.push(r.get(1).map_err(err)?);
        }
    }

    let mut st = conn
        .prepare("SELECT note_id, id, text, done FROM checklist_items ORDER BY note_id, position")
        .map_err(err)?;
    let mut rows = st.query([]).map_err(err)?;
    while let Some(r) = rows.next().map_err(err)? {
        let id: i64 = r.get(0).map_err(err)?;
        if let Some(&i) = index.get(&id) {
            notes[i].checklist.push(ChecklistItem {
                id: Some(r.get(1).map_err(err)?),
                text: r.get(2).map_err(err)?,
                done: r.get(3).map_err(err)?,
            });
        }
    }
    Ok(notes)
}

pub fn get_note(conn: &Connection, id: i64) -> Result<Note> {
    list_notes(conn)?
        .into_iter()
        .find(|n| n.id == id)
        .ok_or_else(|| format!("Catatan {id} tidak ditemukan"))
}

fn next_position(conn: &Connection, status: Status) -> Result<i64> {
    conn.query_row(
        "SELECT COALESCE(MAX(position) + 1, 0) FROM notes WHERE status = ?1",
        [status.as_str()],
        |r| r.get(0),
    )
    .map_err(err)
}

fn validate_due(due: &Option<String>) -> Result<Option<String>> {
    match due.as_deref().map(str::trim) {
        None | Some("") => Ok(None),
        Some(d) => NaiveDate::parse_from_str(d, "%Y-%m-%d")
            .map(|_| Some(d.to_string()))
            .map_err(|_| format!("Format tanggal tidak valid: {d}")),
    }
}

pub fn upsert_note(conn: &mut Connection, input: &NoteInput) -> Result<Note> {
    let title = input.title.trim();
    if title.is_empty() {
        return Err("Judul tidak boleh kosong".into());
    }
    let due = validate_due(&input.due_at)?;
    let ts = now();
    let tx = conn.transaction().map_err(err)?;
    let id = match input.id {
        Some(id) => {
            let old: Option<String> = tx
                .query_row("SELECT status FROM notes WHERE id = ?1", [id], |r| r.get(0))
                .optional()
                .map_err(err)?;
            let old = old.ok_or_else(|| format!("Catatan {id} tidak ditemukan"))?;
            let status_changed = old != input.status.as_str();
            let position = if status_changed { next_position(&tx, input.status)? } else { -1 };
            tx.execute(
                "UPDATE notes SET title = ?2, body = ?3, status = ?4, needs_review = ?5, due_at = ?6, updated_at = ?7,
                   position = CASE WHEN ?8 >= 0 THEN ?8 ELSE position END,
                   done_at = CASE WHEN ?4 = 'done' THEN COALESCE(done_at, ?7) ELSE NULL END
                 WHERE id = ?1",
                params![id, title, input.body, input.status.as_str(), input.needs_review, due, ts, position],
            )
            .map_err(err)?;
            id
        }
        None => {
            // New notes go on top of the column.
            tx.execute("UPDATE notes SET position = position + 1 WHERE status = ?1", [input.status.as_str()])
                .map_err(err)?;
            let done_at = (input.status == Status::Done).then(|| ts.clone());
            tx.execute(
                "INSERT INTO notes(title, body, status, position, needs_review, created_at, updated_at, done_at, due_at)
                 VALUES (?1, ?2, ?3, 0, ?4, ?5, ?5, ?6, ?7)",
                params![title, input.body, input.status.as_str(), input.needs_review, ts, done_at, due],
            )
            .map_err(err)?;
            tx.last_insert_rowid()
        }
    };
    set_tags(&tx, id, &input.tags)?;
    set_checklist(&tx, id, &input.checklist)?;
    tx.commit().map_err(err)?;
    get_note(conn, id)
}

/// Moves a note to `status` at `index` within that column and renumbers the column.
/// Entering Done sets `done_at`; leaving Done clears it.
pub fn move_note(conn: &mut Connection, id: i64, status: Status, index: usize) -> Result<()> {
    let tx = conn.transaction().map_err(err)?;
    let mut ids: Vec<i64> = {
        let mut st = tx
            .prepare("SELECT id FROM notes WHERE status = ?1 AND id != ?2 ORDER BY position, id")
            .map_err(err)?;
        let rows = st.query_map(params![status.as_str(), id], |r| r.get(0)).map_err(err)?;
        rows.collect::<std::result::Result<_, _>>().map_err(err)?
    };
    ids.insert(index.min(ids.len()), id);
    let ts = now();
    let changed = tx
        .execute(
            "UPDATE notes SET status = ?2, updated_at = ?3,
               done_at = CASE WHEN ?2 = 'done' THEN COALESCE(done_at, ?3) ELSE NULL END
             WHERE id = ?1 AND status != ?2",
            params![id, status.as_str(), ts],
        )
        .map_err(err)?;
    if changed == 0 {
        let exists: bool = tx
            .query_row("SELECT COUNT(*) > 0 FROM notes WHERE id = ?1", [id], |r| r.get(0))
            .map_err(err)?;
        if !exists {
            return Err(format!("Catatan {id} tidak ditemukan"));
        }
    }
    {
        let mut st = tx.prepare("UPDATE notes SET position = ?2 WHERE id = ?1").map_err(err)?;
        for (pos, nid) in ids.iter().enumerate() {
            st.execute(params![nid, pos as i64]).map_err(err)?;
        }
    }
    tx.commit().map_err(err)
}

pub fn delete_note(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM notes WHERE id = ?1", [id]).map_err(err)?;
    Ok(())
}

/// Builds an FTS5 prefix query from free text: every token must match as a prefix.
fn fts_query(q: &str) -> Option<String> {
    let parts: Vec<String> = q
        .split(|c: char| !c.is_alphanumeric())
        .filter(|t| !t.is_empty())
        .map(|t| format!("\"{}\"*", t.to_lowercase()))
        .collect();
    (!parts.is_empty()).then(|| parts.join(" "))
}

pub fn search(conn: &Connection, q: &str, limit: usize) -> Result<Vec<i64>> {
    let Some(query) = fts_query(q) else { return Ok(vec![]) };
    let mut st = conn
        .prepare_cached("SELECT rowid FROM notes_fts WHERE notes_fts MATCH ?1 ORDER BY bm25(notes_fts, 4.0, 1.0) LIMIT ?2")
        .map_err(err)?;
    let rows = st.query_map(params![query, limit as i64], |r| r.get(0)).map_err(err)?;
    rows.collect::<std::result::Result<_, _>>().map_err(err)
}

/// Inserts parsed notes. With `replace`, wipes all existing notes first.
pub fn import(conn: &mut Connection, items: &[ParsedNote], replace: bool) -> Result<usize> {
    let ts = now();
    let tx = conn.transaction().map_err(err)?;
    if replace {
        tx.execute_batch("DELETE FROM notes; DELETE FROM tags;").map_err(err)?;
    }
    let mut pos: HashMap<&str, i64> = HashMap::new();
    for s in Status::ALL {
        pos.insert(s.as_str(), next_position(&tx, s)?);
    }
    {
        let mut st = tx
            .prepare(
                "INSERT INTO notes(title, body, status, position, needs_review, review_reason, created_at, updated_at, source_line)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8)",
            )
            .map_err(err)?;
        for it in items {
            let p = pos.get_mut(it.status.as_str()).expect("all statuses present");
            st.execute(params![
                it.title,
                it.body,
                it.status.as_str(),
                *p,
                it.needs_review,
                it.review_reason,
                ts,
                it.source_line
            ])
            .map_err(err)?;
            *p += 1;
            let id = tx.last_insert_rowid();
            set_tags(&tx, id, &it.tags)?;
        }
    }
    tx.commit().map_err(err)?;
    Ok(items.len())
}

/// Notes with a due date that need a reminder now: (note, kind) where kind is "h-1" or "h".
pub fn due_reminders(conn: &Connection, today: NaiveDate) -> Result<Vec<(Note, &'static str)>> {
    let tomorrow = today.succ_opt().unwrap_or(today);
    let mut out = vec![];
    for n in list_notes(conn)? {
        if n.status == Status::Done {
            continue;
        }
        let Some(due) = n.due_at.as_deref().and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok()) else {
            continue;
        };
        let kind = if due == today {
            "h"
        } else if due == tomorrow {
            "h-1"
        } else {
            continue;
        };
        let sent: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM reminder_log WHERE note_id = ?1 AND kind = ?2 AND due_at = ?3",
                params![n.id, kind, n.due_at],
                |r| r.get(0),
            )
            .map_err(err)?;
        if !sent {
            out.push((n, kind));
        }
    }
    Ok(out)
}

pub fn mark_reminded(conn: &Connection, note: &Note, kind: &str) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO reminder_log(note_id, kind, due_at) VALUES (?1, ?2, ?3)",
        params![note.id, kind, note.due_at],
    )
    .map_err(err)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser;

    fn input(title: &str, status: Status) -> NoteInput {
        NoteInput {
            id: None,
            title: title.into(),
            body: String::new(),
            status,
            needs_review: false,
            due_at: None,
            tags: vec![],
            checklist: vec![],
        }
    }

    #[test]
    fn migrates_idempotently() {
        let dir = std::env::temp_dir().join(format!("aria-test-{}.db", std::process::id()));
        let _ = std::fs::remove_file(&dir);
        drop(open(&dir).unwrap());
        let conn = open(&dir).unwrap();
        let v: usize = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
        assert_eq!(v, MIGRATIONS.len());
        drop(conn);
        let _ = std::fs::remove_file(&dir);
    }

    #[test]
    fn upsert_with_tags_and_checklist() {
        let mut c = open_in_memory().unwrap();
        let mut i = input("Setting tunnel", Status::Todo);
        i.tags = vec!["infra".into(), "baru".into()];
        i.checklist = vec![ChecklistItem { id: None, text: "cek DNS".into(), done: false }];
        i.due_at = Some("2026-10-28".into());
        let n = upsert_note(&mut c, &i).unwrap();
        assert_eq!(n.tags, vec!["baru", "infra"]);
        assert_eq!(n.checklist.len(), 1);
        assert_eq!(n.due_at.as_deref(), Some("2026-10-28"));
        assert_eq!(list_tags(&c).unwrap().len(), 2);

        let mut edit = i.clone();
        edit.id = Some(n.id);
        edit.title = "Setting tunnel cloudflare".into();
        edit.tags = vec!["infra".into()];
        let n2 = upsert_note(&mut c, &edit).unwrap();
        assert_eq!(n2.title, "Setting tunnel cloudflare");
        assert_eq!(n2.tags, vec!["infra"]);
        assert_eq!(search(&c, "cloudfl", 10).unwrap(), vec![n.id]);
    }

    #[test]
    fn rejects_bad_input() {
        let mut c = open_in_memory().unwrap();
        assert!(upsert_note(&mut c, &input("   ", Status::Todo)).is_err());
        let mut i = input("ok", Status::Todo);
        i.due_at = Some("28/10/2026".into());
        assert!(upsert_note(&mut c, &i).is_err());
    }

    #[test]
    fn move_to_done_sets_done_at_and_reorders() {
        let mut c = open_in_memory().unwrap();
        let a = upsert_note(&mut c, &input("a", Status::Todo)).unwrap();
        let b = upsert_note(&mut c, &input("b", Status::Todo)).unwrap();
        let d = upsert_note(&mut c, &input("d", Status::Done)).unwrap();
        // New notes go to the top: todo = [b, a].
        move_note(&mut c, a.id, Status::Done, 1).unwrap();
        let notes = list_notes(&c).unwrap();
        let a2 = notes.iter().find(|n| n.id == a.id).unwrap();
        assert!(a2.done_at.is_some());
        let done: Vec<i64> = notes.iter().filter(|n| n.status == Status::Done).map(|n| n.id).collect();
        assert_eq!(done, vec![d.id, a.id]);

        move_note(&mut c, a.id, Status::Todo, 0).unwrap();
        let a3 = get_note(&c, a.id).unwrap();
        assert!(a3.done_at.is_none());
        let todo: Vec<i64> = list_notes(&c).unwrap().iter().filter(|n| n.status == Status::Todo).map(|n| n.id).collect();
        assert_eq!(todo, vec![a.id, b.id]);
        assert!(move_note(&mut c, 9999, Status::Todo, 0).is_err());
    }

    #[test]
    fn delete_cascades() {
        let mut c = open_in_memory().unwrap();
        let mut i = input("hapus", Status::Todo);
        i.checklist = vec![ChecklistItem { id: None, text: "x".into(), done: true }];
        let n = upsert_note(&mut c, &i).unwrap();
        delete_note(&c, n.id).unwrap();
        let cnt: i64 = c.query_row("SELECT COUNT(*) FROM checklist_items", [], |r| r.get(0)).unwrap();
        assert_eq!(cnt, 0);
        assert!(search(&c, "hapus", 10).unwrap().is_empty());
    }

    #[test]
    fn import_real_file_and_search() {
        let mut c = open_in_memory().unwrap();
        let items = parser::parse(include_str!("../tests/fixtures/Notes.txt"));
        let start = std::time::Instant::now();
        assert_eq!(import(&mut c, &items, true).unwrap(), 88);
        let elapsed = start.elapsed();
        assert!(elapsed.as_millis() < 200, "import took {elapsed:?}");
        let hits = search(&c, "cloudflare", 50).unwrap();
        assert!(!hits.is_empty());
        let notes = list_notes(&c).unwrap();
        let first = notes.iter().find(|n| n.id == hits[0]).unwrap();
        assert!(first.tags.contains(&"infra".to_string()));
        // Re-import with replace keeps the count stable.
        import(&mut c, &items, true).unwrap();
        assert_eq!(list_notes(&c).unwrap().len(), 88);
        // Odd query characters do not break FTS syntax.
        assert!(search(&c, "\"(*:", 10).unwrap().is_empty());
    }

    #[test]
    fn search_5000_cards_under_50ms() {
        let mut c = open_in_memory().unwrap();
        let base = parser::parse(include_str!("../tests/fixtures/Notes.txt"));
        let items: Vec<_> = base.iter().cycle().take(5000).cloned().collect();
        import(&mut c, &items, true).unwrap();
        search(&c, "warmup", 50).unwrap();
        for q in ["cloudflare", "sidebar menu", "rec", "modul kas bank"] {
            let start = std::time::Instant::now();
            let hits = search(&c, q, 50).unwrap();
            let ms = start.elapsed().as_secs_f64() * 1000.0;
            assert!(ms < 50.0, "search {q:?} took {ms:.1} ms");
            assert!(!hits.is_empty(), "no hits for {q:?}");
        }
    }

    #[test]
    fn reminders_h1_and_h_once() {
        let mut c = open_in_memory().unwrap();
        let today = NaiveDate::from_ymd_opt(2026, 10, 12).unwrap();
        let mut a = input("besok", Status::Todo);
        a.due_at = Some("2026-10-13".into());
        let mut b = input("hari ini", Status::Ongoing);
        b.due_at = Some("2026-10-12".into());
        let mut d = input("selesai", Status::Done);
        d.due_at = Some("2026-10-12".into());
        for i in [&a, &b, &d] {
            upsert_note(&mut c, i).unwrap();
        }
        let due = due_reminders(&c, today).unwrap();
        let kinds: Vec<(&str, &str)> = due.iter().map(|(n, k)| (n.title.as_str(), *k)).collect();
        assert_eq!(kinds.len(), 2);
        assert!(kinds.contains(&("besok", "h-1")));
        assert!(kinds.contains(&("hari ini", "h")));
        for (n, k) in &due {
            mark_reminded(&c, n, k).unwrap();
        }
        assert!(due_reminders(&c, today).unwrap().is_empty());
    }
}
