import { create } from "zustand";
import { api, errorText } from "../lib/api";
import type { Note, NoteInput, Status, Tag } from "../lib/types";

export type View = "board" | "archive";
/** Sidebar filter: a tag name, "__review" for notes needing review, or null for all. */
export type Filter = string | null;
export const REVIEW_FILTER = "__review";

interface Toast {
  id: number;
  text: string;
  tone: "ok" | "error";
}

interface NotesState {
  notes: Note[];
  tags: Tag[];
  loaded: boolean;
  loadError: string | null;
  view: View;
  filter: Filter;
  selectedId: number | null;
  paletteOpen: boolean;
  importOpen: boolean;
  exportOpen: boolean;
  toast: Toast | null;

  load: () => Promise<void>;
  save: (input: NoteInput) => Promise<Note>;
  move: (id: number, status: Status, index: number) => Promise<void>;
  remove: (id: number) => Promise<void>;
  select: (id: number | null) => void;
  setView: (v: View) => void;
  setFilter: (f: Filter) => void;
  setPalette: (open: boolean) => void;
  setImport: (open: boolean) => void;
  setExport: (open: boolean) => void;
  notify: (text: string, tone?: Toast["tone"]) => void;
}

let toastSeq = 0;

export const useNotes = create<NotesState>((set, get) => ({
  notes: [],
  tags: [],
  loaded: false,
  loadError: null,
  view: "board",
  filter: null,
  selectedId: null,
  paletteOpen: false,
  importOpen: false,
  exportOpen: false,
  toast: null,

  load: async () => {
    try {
      const { notes, tags } = await api.list();
      set({ notes, tags, loaded: true, loadError: null });
    } catch (e) {
      set({ loaded: true, loadError: errorText(e) });
    }
  },

  save: async (input) => {
    const note = await api.upsert(input);
    set((s) => {
      const exists = s.notes.some((n) => n.id === note.id);
      const shifted = exists
        ? s.notes
        : s.notes.map((n) => (n.status === note.status ? { ...n, position: n.position + 1 } : n));
      return { notes: exists ? shifted.map((n) => (n.id === note.id ? note : n)) : [note, ...shifted] };
    });
    // Tags may have been created; refresh quietly.
    if (input.tags.some((t) => !get().tags.some((x) => x.name === t))) void get().load();
    return note;
  },

  move: async (id, status, index) => {
    const prev = get().notes;
    const moving = prev.find((n) => n.id === id);
    if (!moving) return;
    const now = new Date().toISOString().slice(0, 19);
    const target = prev
      .filter((n) => n.status === status && n.id !== id)
      .sort((a, b) => a.position - b.position);
    const updated: Note = {
      ...moving,
      status,
      doneAt: status === "done" ? (moving.doneAt ?? now) : null,
    };
    target.splice(Math.min(index, target.length), 0, updated);
    const pos = new Map(target.map((n, i) => [n.id, i]));
    set({
      notes: prev.map((n) => (n.id === id ? { ...updated, position: pos.get(id)! } : pos.has(n.id) ? { ...n, position: pos.get(n.id)! } : n)),
    });
    try {
      await api.move(id, status, index);
    } catch (e) {
      set({ notes: prev });
      get().notify(errorText(e), "error");
    }
  },

  remove: async (id) => {
    await api.remove(id);
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id), selectedId: s.selectedId === id ? null : s.selectedId }));
  },

  select: (selectedId) => set({ selectedId }),
  setView: (view) => set({ view }),
  setFilter: (filter) => set({ filter }),
  setPalette: (paletteOpen) => set({ paletteOpen }),
  setImport: (importOpen) => set({ importOpen }),
  setExport: (exportOpen) => set({ exportOpen }),
  notify: (text, tone = "ok") => {
    const id = ++toastSeq;
    set({ toast: { id, text, tone } });
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null });
    }, 2600);
  },
}));

export function matchesFilter(n: Note, filter: Filter): boolean {
  if (!filter) return true;
  if (filter === REVIEW_FILTER) return n.needsReview;
  return n.tags.includes(filter);
}

export function byPosition(a: Note, b: Note): number {
  return a.position - b.position || a.id - b.id;
}
