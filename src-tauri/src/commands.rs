//! Tauri commands exposed to the frontend. Thin wrappers over `db`, `parser`, `export`.

use crate::db::{self, err, Note, NoteInput, Result, Tag};
use crate::export;
use crate::parser::{self, ParsedNote, Status};
use chrono::NaiveDate;
use rusqlite::Connection;
use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

pub struct AppState {
    pub db: Mutex<Connection>,
}

/// Event emitted after any write so every window (board, quick capture) reloads.
pub const CHANGED: &str = "notes-changed";

fn changed(app: &AppHandle) {
    let _ = app.emit(CHANGED, ());
}

fn lock<'a>(state: &'a State<'_, AppState>) -> Result<std::sync::MutexGuard<'a, Connection>> {
    state.db.lock().map_err(|_| "Database sedang terkunci".to_string())
}

#[derive(Serialize)]
pub struct Snapshot {
    notes: Vec<Note>,
    tags: Vec<Tag>,
}

#[tauri::command]
pub fn notes_list(state: State<AppState>) -> Result<Snapshot> {
    let conn = lock(&state)?;
    Ok(Snapshot { notes: db::list_notes(&conn)?, tags: db::list_tags(&conn)? })
}

#[tauri::command]
pub fn note_upsert(app: AppHandle, state: State<AppState>, input: NoteInput) -> Result<Note> {
    let note = db::upsert_note(&mut *lock(&state)?, &input)?;
    changed(&app);
    Ok(note)
}

#[tauri::command]
pub fn note_move(app: AppHandle, state: State<AppState>, id: i64, status: Status, index: usize) -> Result<()> {
    db::move_note(&mut *lock(&state)?, id, status, index)?;
    changed(&app);
    Ok(())
}

#[tauri::command]
pub fn note_delete(app: AppHandle, state: State<AppState>, id: i64) -> Result<()> {
    db::delete_note(&*lock(&state)?, id)?;
    changed(&app);
    Ok(())
}

#[tauri::command]
pub fn search(state: State<AppState>, q: String) -> Result<Vec<i64>> {
    db::search(&*lock(&state)?, &q, 100)
}

#[tauri::command]
pub fn tag_update(app: AppHandle, state: State<AppState>, id: i64, name: String, color: String) -> Result<()> {
    db::update_tag(&*lock(&state)?, id, &name, &color)?;
    changed(&app);
    Ok(())
}

#[tauri::command]
pub fn tag_delete(app: AppHandle, state: State<AppState>, id: i64) -> Result<()> {
    db::delete_tag(&*lock(&state)?, id)?;
    changed(&app);
    Ok(())
}

#[tauri::command]
pub fn import_preview(path: String) -> Result<Vec<ParsedNote>> {
    let bytes = std::fs::read(&path).map_err(|e| format!("Gagal membaca {path}: {e}"))?;
    let items = parser::parse(&String::from_utf8_lossy(&bytes));
    if items.is_empty() {
        return Err("Tidak ada item yang dikenali. Pastikan file berisi bagian \"List yang belum dikerjakan:\" dan baris \"- ...\".".into());
    }
    Ok(items)
}

#[tauri::command]
pub fn import_commit(app: AppHandle, state: State<AppState>, items: Vec<ParsedNote>, replace: bool) -> Result<usize> {
    let n = db::import(&mut *lock(&state)?, &items, replace)?;
    changed(&app);
    Ok(n)
}

#[tauri::command]
pub fn export_txt(state: State<AppState>, path: String) -> Result<usize> {
    let notes = db::list_notes(&*lock(&state)?)?;
    std::fs::write(&path, export::to_txt(&notes)).map_err(err)?;
    Ok(notes.len())
}

fn parse_date(d: Option<String>) -> Result<Option<NaiveDate>> {
    match d.as_deref().map(str::trim) {
        None | Some("") => Ok(None),
        Some(s) => NaiveDate::parse_from_str(s, "%Y-%m-%d").map(Some).map_err(|_| format!("Tanggal tidak valid: {s}")),
    }
}

#[tauri::command]
pub fn export_md(state: State<AppState>, path: String, from: Option<String>, to: Option<String>) -> Result<()> {
    let (from, to) = (parse_date(from)?, parse_date(to)?);
    if let (Some(f), Some(t)) = (from, to) {
        if f > t {
            return Err("Tanggal awal harus sebelum tanggal akhir".into());
        }
    }
    let notes = db::list_notes(&*lock(&state)?)?;
    std::fs::write(&path, export::to_md(&notes, from, to)).map_err(err)
}
