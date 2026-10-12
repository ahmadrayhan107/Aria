/**
 * Browser-only mock of the Tauri backend, for `bun run dev` in a normal browser (UI checks, screenshots).
 * Loaded only when the page runs outside Tauri. Not included in the Tauri build path.
 */
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import type { Note, NoteInput, ParsedNote, Status, Tag } from "../lib/types";
import { autoTags } from "../lib/tags";
import { splitTitle } from "../lib/title";
import fixture from "../../src-tauri/tests/fixtures/Notes.txt?raw";

const COLORS: Record<string, string> = {
  approval: "#3f9f7f", erp: "#5b8def", recruitment: "#d0893f", web: "#c2607a", infra: "#7c8a9a", riset: "#b59a3b", tim: "#4fa3b8",
};

let notes: Note[] = [];
let tags: Tag[] = [];
let seq = 1;
const now = () => new Date().toISOString().slice(0, 19);

function ensureTags(names: string[]) {
  for (const n of names) if (!tags.some((t) => t.name === n)) tags.push({ id: seq++, name: n, color: COLORS[n] ?? "#8f7a66" });
  tags.sort((a, b) => a.name.localeCompare(b.name));
}

function parse(text: string): ParsedNote[] {
  const out: ParsedNote[] = [];
  let status: Status | null = null;
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    const l = line.toLowerCase();
    if (!line.startsWith("-") && line.endsWith(":")) {
      status = l.includes("belum dikerjakan") ? "todo" : l.includes("sudah dikerjakan") ? "done" : l.includes("pending") ? "pending" : l.includes("ongoing") ? "ongoing" : status;
      return;
    }
    if (!status || !line.startsWith("-")) return;
    const t = line.slice(1).trim();
    const review = status !== "todo" && l.slice(1).trim().startsWith("belum dikerjakan")
      ? "Diawali \"Belum dikerjakan\" tapi ada di bagian selesai"
      : status === "todo" && /tidak saya|di bawah target|^- kondisi /.test(l) ? "Berbentuk laporan, bukan tugas" : null;
    out.push({ ...splitTitle(t), status, needs_review: !!review, review_reason: review, source_line: i + 1, tags: autoTags(t) });
  });
  return out;
}

function upsert(input: NoteInput): Note {
  ensureTags(input.tags);
  const old = notes.find((n) => n.id === input.id);
  const ts = now();
  if (old) {
    Object.assign(old, input, {
      updatedAt: ts,
      doneAt: input.status === "done" ? (old.doneAt ?? ts) : null,
      position: old.status === input.status ? old.position : 1e6,
    });
    return old;
  }
  notes.forEach((n) => n.status === input.status && n.position++);
  const n: Note = {
    ...input, id: seq++, position: 0, reviewReason: null, createdAt: ts, updatedAt: ts,
    doneAt: input.status === "done" ? ts : null, sourceLine: null,
  };
  notes.push(n);
  return n;
}

export function installMock() {
  mockWindows("main");
  mockIPC((cmd, args) => {
    const a = (args ?? {}) as Record<string, any>;
    switch (cmd) {
      case "notes_list":
        return { notes: structuredClone(notes), tags };
      case "note_upsert":
        return structuredClone(upsert(a.input));
      case "note_move": {
        const n = notes.find((x) => x.id === a.id)!;
        const col = notes.filter((x) => x.status === a.status && x.id !== a.id).sort((x, y) => x.position - y.position);
        if (n.status !== a.status) n.doneAt = a.status === "done" ? (n.doneAt ?? now()) : null;
        n.status = a.status;
        col.splice(a.index, 0, n);
        col.forEach((x, i) => (x.position = i));
        return null;
      }
      case "note_delete":
        notes = notes.filter((n) => n.id !== a.id);
        return null;
      case "search": {
        const toks = String(a.q).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
        return notes
          .filter((n) => toks.every((t) => `${n.title} ${n.body}`.toLowerCase().split(/[^\p{L}\p{N}]+/u).some((w) => w.startsWith(t))))
          .map((n) => n.id);
      }
      case "import_preview":
        return parse(fixture);
      case "import_commit": {
        if (a.replace) {
          notes = [];
          tags = [];
        }
        const pos: Record<string, number> = {};
        for (const it of a.items as ParsedNote[]) {
          ensureTags(it.tags);
          pos[it.status] = (pos[it.status] ?? -1) + 1;
          notes.push({
            id: seq++, title: it.title, body: it.body, status: it.status, position: pos[it.status]!, needsReview: it.needs_review,
            reviewReason: it.review_reason, createdAt: now(), updatedAt: now(), doneAt: null, dueAt: null, sourceLine: it.source_line,
            tags: it.tags, checklist: [],
          });
        }
        return a.items.length;
      }
      case "export_txt":
        return notes.length;
      case "plugin:dialog|open":
        return "C:\\Users\\demo\\Documents\\Notes.txt";
      case "plugin:dialog|save":
        return "C:\\Users\\demo\\Documents\\export.txt";
      case "plugin:clipboard-manager|write_text":
        console.log("[mock clipboard]\n" + a.text);
        return null;
      default:
        return null;
    }
  });
}
