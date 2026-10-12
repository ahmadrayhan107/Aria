//! Export to the original Notes.txt format and to a Markdown report of finished work.

use crate::db::Note;
use crate::parser::{join_title, Status};
use chrono::NaiveDate;

/// Section order of the original file.
const ORDER: [Status; 4] = [Status::Todo, Status::Done, Status::Pending, Status::Ongoing];

/// Writes notes back in the Notes.txt layout (CRLF, two blank lines between sections).
/// Checklist items are appended as ` [x] text;` so nothing is lost.
pub fn to_txt(notes: &[Note]) -> String {
    let mut sections = Vec::new();
    for status in ORDER {
        let mut items: Vec<&Note> = notes.iter().filter(|n| n.status == status).collect();
        items.sort_by_key(|n| (n.position, n.id));
        let mut lines = vec![status.header().to_string()];
        for n in items {
            let mut text = join_title(&n.title, &n.body);
            for c in &n.checklist {
                text.push_str(&format!(" [{}] {};", if c.done { "x" } else { " " }, c.text));
            }
            lines.push(format!("- {text}"));
        }
        sections.push(lines.join("\r\n"));
    }
    sections.join("\r\n\r\n\r\n")
}

fn done_date(n: &Note) -> Option<NaiveDate> {
    n.done_at.as_deref().and_then(|d| NaiveDate::parse_from_str(d.get(..10)?, "%Y-%m-%d").ok())
}

/// Markdown report of Done notes whose `done_at` lies in [from, to] (inclusive), grouped by day.
/// With no range, includes every Done note; undated ones go into their own group.
pub fn to_md(notes: &[Note], from: Option<NaiveDate>, to: Option<NaiveDate>) -> String {
    let ranged = from.is_some() || to.is_some();
    let mut dated: Vec<(NaiveDate, &Note)> = vec![];
    let mut undated: Vec<&Note> = vec![];
    for n in notes.iter().filter(|n| n.status == Status::Done) {
        match done_date(n) {
            Some(d) if from.map_or(true, |f| d >= f) && to.map_or(true, |t| d <= t) => dated.push((d, n)),
            None if !ranged => undated.push(n),
            _ => {}
        }
    }
    dated.sort_by(|a, b| a.0.cmp(&b.0).then(a.1.done_at.cmp(&b.1.done_at)));

    let fmt = |d: NaiveDate| d.format("%d/%m/%Y").to_string();
    let mut out = String::from("# Laporan pekerjaan selesai\n\n");
    match (from, to) {
        (Some(f), Some(t)) => out.push_str(&format!("Periode: {} - {}\n\n", fmt(f), fmt(t))),
        (Some(f), None) => out.push_str(&format!("Periode: sejak {}\n\n", fmt(f))),
        (None, Some(t)) => out.push_str(&format!("Periode: sampai {}\n\n", fmt(t))),
        (None, None) => {}
    }
    out.push_str(&format!("Total: {} item\n", dated.len() + undated.len()));

    let item = |n: &Note| {
        let mut line = format!("- {}", n.title);
        if !n.tags.is_empty() {
            line.push_str(&format!(" `{}`", n.tags.join("`, `")));
        }
        if !n.body.trim().is_empty() {
            line.push_str(&format!("\n  {}", n.body.trim().replace('\n', "\n  ")));
        }
        line.push('\n');
        line
    };
    let mut current = None;
    for (d, n) in &dated {
        if current != Some(*d) {
            out.push_str(&format!("\n## {}\n\n", fmt(*d)));
            current = Some(*d);
        }
        out.push_str(&item(n));
    }
    if !undated.is_empty() {
        out.push_str("\n## Tanpa tanggal selesai\n\n");
        for n in undated {
            out.push_str(&item(n));
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::parser::{self, ParsedNote};

    const FIXTURE: &str = include_str!("../tests/fixtures/Notes.txt");

    fn key(items: &[ParsedNote]) -> Vec<(Status, String)> {
        items.iter().map(|n| (n.status, n.text())).collect()
    }

    #[test]
    fn txt_round_trip_is_identical() {
        let mut c = db::open_in_memory().unwrap();
        let original = parser::parse(FIXTURE);
        db::import(&mut c, &original, true).unwrap();
        let txt = to_txt(&db::list_notes(&c).unwrap());
        let again = parser::parse(&txt);
        assert_eq!(key(&original), key(&again));
        assert_eq!(again.iter().filter(|n| n.needs_review).count(), original.iter().filter(|n| n.needs_review).count());

        // Text content equals the original file modulo trailing spaces and the final newline.
        let norm = |s: &str| s.lines().map(str::trim_end).collect::<Vec<_>>().join("\n").trim_end().to_string();
        assert_eq!(norm(&txt), norm(FIXTURE));
    }

    #[test]
    fn md_report_filters_by_range() {
        let mut c = db::open_in_memory().unwrap();
        db::import(&mut c, &parser::parse(FIXTURE), true).unwrap();
        let mut notes = db::list_notes(&c).unwrap();
        let mut done: Vec<&mut Note> = notes.iter_mut().filter(|n| n.status == Status::Done).collect();
        done[0].done_at = Some("2026-10-01T09:00:00".into());
        done[1].done_at = Some("2026-10-05T10:00:00".into());
        done[2].done_at = Some("2026-09-20T10:00:00".into());
        let (t0, t1) = (done[0].title.clone(), done[1].title.clone());
        let d = |s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok();
        let md = to_md(&notes, d("2026-10-01"), d("2026-10-31"));
        assert!(md.contains("Total: 2 item"), "{md}");
        assert!(md.contains("## 01/10/2026") && md.contains("## 05/10/2026"));
        assert!(md.find(&t0).unwrap() < md.find(&t1).unwrap());
        assert!(!md.contains("Tanpa tanggal"));
        let all = to_md(&notes, None, None);
        assert!(all.contains("Total: 77 item"));
        assert!(all.contains("## Tanpa tanggal selesai"));
    }

    #[test]
    fn checklist_is_kept_in_txt() {
        let mut c = db::open_in_memory().unwrap();
        let n = db::upsert_note(
            &mut c,
            &db::NoteInput {
                id: None,
                title: "Deploy".into(),
                body: "ke NAS".into(),
                status: Status::Ongoing,
                needs_review: false,
                due_at: None,
                tags: vec![],
                checklist: vec![db::ChecklistItem { id: None, text: "build".into(), done: true }],
            },
        )
        .unwrap();
        let txt = to_txt(&[n]);
        assert!(txt.ends_with("List Ongoing:\r\n- Deploy ke NAS [x] build;"), "{txt}");
    }
}
