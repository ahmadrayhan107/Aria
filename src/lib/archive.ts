import { groupKey, type Grouping } from "./dates";
import type { Note } from "./types";

export interface Group {
  key: string;
  label: string;
  notes: Note[];
}

const UNDATED = "~";

export function groupDone(notes: Note[], by: Grouping): Group[] {
  const groups = new Map<string, Group>();
  for (const n of notes) {
    const g = n.doneAt ? groupKey(n.doneAt, by) : { key: UNDATED, label: "Tanpa tanggal selesai (hasil impor)" };
    let entry = groups.get(g.key);
    if (!entry) groups.set(g.key, (entry = { ...g, notes: [] }));
    entry.notes.push(n);
  }
  for (const g of groups.values()) {
    g.notes.sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? "") || a.position - b.position);
  }
  // Newest first; undated last.
  return [...groups.values()].sort((a, b) => (a.key === UNDATED ? 1 : b.key === UNDATED ? -1 : b.key.localeCompare(a.key)));
}
