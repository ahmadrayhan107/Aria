//! Parser for the legacy `Notes.txt` format.
//!
//! The file is a list of sections. Each section starts with a header line such as
//! `List yang belum dikerjakan:` and contains `- item` lines.

use serde::{Deserialize, Serialize};

/// Max title length (in chars) before we split on the last space instead of a sentence end.
const TITLE_MAX: usize = 120;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    Todo,
    Ongoing,
    Pending,
    Done,
}

impl Status {
    pub const ALL: [Status; 4] = [Status::Todo, Status::Done, Status::Pending, Status::Ongoing];

    pub fn as_str(self) -> &'static str {
        match self {
            Status::Todo => "todo",
            Status::Ongoing => "ongoing",
            Status::Pending => "pending",
            Status::Done => "done",
        }
    }

    pub fn parse(s: &str) -> Option<Status> {
        match s {
            "todo" => Some(Status::Todo),
            "ongoing" => Some(Status::Ongoing),
            "pending" => Some(Status::Pending),
            "done" => Some(Status::Done),
            _ => None,
        }
    }

    /// Section header as written in Notes.txt.
    pub fn header(self) -> &'static str {
        match self {
            Status::Todo => "List yang belum dikerjakan:",
            Status::Done => "List yang sudah dikerjakan:",
            Status::Pending => "List Pending:",
            Status::Ongoing => "List Ongoing:",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ParsedNote {
    pub title: String,
    pub body: String,
    pub status: Status,
    pub needs_review: bool,
    pub review_reason: Option<String>,
    pub source_line: u32,
    pub tags: Vec<String>,
}

impl ParsedNote {
    pub fn text(&self) -> String {
        join_title(&self.title, &self.body)
    }
}

fn section_of(line: &str) -> Option<Status> {
    let l = line.trim().to_lowercase();
    if l.starts_with('-') || !l.ends_with(':') {
        return None;
    }
    if l.contains("belum dikerjakan") {
        Some(Status::Todo)
    } else if l.contains("sudah dikerjakan") {
        Some(Status::Done)
    } else if l.contains("pending") {
        Some(Status::Pending)
    } else if l.contains("ongoing") {
        Some(Status::Ongoing)
    } else {
        None
    }
}

/// Split one-line text into (title, body). Title is the first sentence.
/// Invariant: `join_title(split_title(t)) == t` for any text without newlines.
pub fn split_title(text: &str) -> (String, String) {
    let text = text.trim();
    let chars: Vec<(usize, char)> = text.char_indices().collect();
    // First ". " / "? " / "! " within the limit.
    for w in chars.windows(2) {
        let ((_, a), (i, b)) = (w[0], w[1]);
        if w[0].0 > 0 && matches!(a, '.' | '?' | '!') && b == ' ' {
            if text[..i].chars().count() > TITLE_MAX {
                break;
            }
            return (text[..i].to_string(), text[i + 1..].to_string());
        }
    }
    if chars.len() <= TITLE_MAX {
        return (text.to_string(), String::new());
    }
    // Too long without a sentence end: cut at the last space before the limit.
    let limit = chars[TITLE_MAX].0;
    match text[..limit].rfind(' ') {
        Some(i) if i > 0 => (text[..i].to_string(), text[i + 1..].to_string()),
        _ => (text.to_string(), String::new()),
    }
}

pub fn join_title(title: &str, body: &str) -> String {
    let body = body.replace("\r\n", " ").replace('\n', " ");
    if body.is_empty() {
        title.to_string()
    } else {
        format!("{title} {body}")
    }
}

/// Markers that make a todo line look like a status report instead of a task.
const REPORT_MARKERS: &[&str] = &[
    "tidak saya",
    "saya tidak",
    "di bawah target",
    "di atas target",
    "belum terpasang",
    "perlu diulang",
    "hasil uji",
];
const REPORT_PREFIXES: &[&str] = &["kondisi ", "hasil ", "status ", "laporan "];

fn review_reason(text: &str, status: Status) -> Option<String> {
    let l = text.to_lowercase();
    if status != Status::Todo && l.starts_with("belum dikerjakan") {
        return Some("Diawali \"Belum dikerjakan\" tapi ada di bagian selesai".into());
    }
    if status == Status::Todo
        && (REPORT_PREFIXES.iter().any(|p| l.starts_with(p))
            || REPORT_MARKERS.iter().any(|m| l.contains(m)))
    {
        return Some("Berbentuk laporan, bukan tugas".into());
    }
    None
}

/// Keyword rules: (tag, keywords). Single words match whole tokens; phrases match substrings.
pub const TAG_RULES: &[(&str, &[&str])] = &[
    ("approval", &["approval"]),
    ("erp", &["erp", "payroll", "invoice", "gudang"]),
    ("recruitment", &["recruitment", "pelamar", "lamaran"]),
    ("web", &["website", "landing", "karir", "seo"]),
    (
        "infra",
        &["nas", "synology", "cloudflare", "dns", "email server", "tunnel", "web-station"],
    ),
    ("riset", &["research", "riset", "jetson", "standar"]),
    ("tim", &["tim", "team", "talent"]),
];

pub fn auto_tags(text: &str) -> Vec<String> {
    let lower = text.to_lowercase();
    let tokens: Vec<&str> = lower
        .split(|c: char| !c.is_alphanumeric())
        .filter(|t| !t.is_empty())
        .collect();
    TAG_RULES
        .iter()
        .filter(|(_, kws)| {
            kws.iter().any(|kw| {
                if kw.contains(|c: char| !c.is_alphanumeric()) {
                    lower.contains(kw)
                } else {
                    tokens.contains(kw)
                }
            })
        })
        .map(|(tag, _)| tag.to_string())
        .collect()
}

pub fn parse(input: &str) -> Vec<ParsedNote> {
    let input = input.strip_prefix('\u{feff}').unwrap_or(input);
    let mut out = Vec::new();
    let mut current: Option<Status> = None;
    for (idx, raw) in input.lines().enumerate() {
        let line = raw.trim();
        if line.is_empty() {
            continue;
        }
        if let Some(s) = section_of(line) {
            current = Some(s);
            continue;
        }
        let Some(status) = current else { continue };
        let Some(rest) = line.strip_prefix('-') else {
            // Continuation line of the previous item.
            if let Some(prev) = out.last_mut().filter(|p: &&mut ParsedNote| p.status == status) {
                let text = format!("{} {}", prev.text(), line);
                let (t, b) = split_title(&text);
                prev.title = t;
                prev.body = b;
            }
            continue;
        };
        let text = rest.trim();
        if text.is_empty() {
            continue;
        }
        let (title, body) = split_title(text);
        let reason = review_reason(text, status);
        out.push(ParsedNote {
            title,
            body,
            status,
            needs_review: reason.is_some(),
            review_reason: reason,
            source_line: idx as u32 + 1,
            tags: auto_tags(text),
        });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("../tests/fixtures/Notes.txt");

    fn count(notes: &[ParsedNote], s: Status) -> usize {
        notes.iter().filter(|n| n.status == s).count()
    }

    #[test]
    fn parses_real_notes_file() {
        let notes = parse(FIXTURE);
        assert_eq!(count(&notes, Status::Todo), 10);
        assert_eq!(count(&notes, Status::Done), 77);
        assert_eq!(count(&notes, Status::Pending), 1);
        assert_eq!(count(&notes, Status::Ongoing), 0);
    }

    #[test]
    fn flags_misplaced_items() {
        let notes = parse(FIXTURE);
        let flagged: Vec<u32> = notes.iter().filter(|n| n.needs_review).map(|n| n.source_line).collect();
        // Line 59: "Belum dikerjakan: ..." inside done. Lines 7-8: reports inside todo.
        assert!(flagged.contains(&59), "flagged: {flagged:?}");
        assert!(flagged.contains(&7), "flagged: {flagged:?}");
        assert!(flagged.contains(&8), "flagged: {flagged:?}");
        assert!(flagged.len() <= 4, "too many false positives: {flagged:?}");
    }

    #[test]
    fn split_title_is_reversible() {
        for n in parse(FIXTURE) {
            let original = FIXTURE.lines().nth(n.source_line as usize - 1).unwrap();
            let original = original.trim().trim_start_matches('-').trim();
            assert_eq!(n.text(), original);
            assert!(n.title.chars().count() <= TITLE_MAX + 1);
        }
    }

    #[test]
    fn split_title_first_sentence() {
        let (t, b) = split_title("Mode worker tidak jalan. Mode klasik di bawah target.");
        assert_eq!(t, "Mode worker tidak jalan.");
        assert_eq!(b, "Mode klasik di bawah target.");
        assert_eq!(split_title("Modul Aset.").1, "");
        // Dots inside URLs/domains are not sentence ends.
        assert_eq!(split_title("cek erp.example.com sekarang").1, "");
    }

    #[test]
    fn tags_by_keyword() {
        assert_eq!(auto_tags("setting email server synology dan config tunnel cloudflare"), vec!["infra"]);
        assert_eq!(auto_tags("perbarui halaman karir di website"), vec!["web"]);
        assert_eq!(auto_tags("buat tim untuk go to CTO, hunting talent"), vec!["tim"]);
        assert_eq!(auto_tags("Research AI untuk erp.example.com jetson"), vec!["erp", "riset"]);
        assert!(auto_tags("timeline proyek").is_empty());
    }

    #[test]
    fn reads_bom_and_lf() {
        let notes = parse("\u{feff}List Ongoing:\n- satu\n- dua\n");
        assert_eq!(notes.len(), 2);
        assert_eq!(notes[1].status, Status::Ongoing);
        assert_eq!(notes[1].source_line, 3);
    }
}
