import { invoke } from "@tauri-apps/api/core";
import type { Note, NoteInput, ParsedNote, Status, Tag } from "./types";

export const api = {
  list: () => invoke<{ notes: Note[]; tags: Tag[] }>("notes_list"),
  upsert: (input: NoteInput) => invoke<Note>("note_upsert", { input }),
  move: (id: number, status: Status, index: number) => invoke<void>("note_move", { id, status, index }),
  remove: (id: number) => invoke<void>("note_delete", { id }),
  search: (q: string) => invoke<number[]>("search", { q }),
  tagUpdate: (id: number, name: string, color: string) => invoke<void>("tag_update", { id, name, color }),
  tagDelete: (id: number) => invoke<void>("tag_delete", { id }),
  importPreview: (path: string) => invoke<ParsedNote[]>("import_preview", { path }),
  importCommit: (items: ParsedNote[], replace: boolean) => invoke<number>("import_commit", { items, replace }),
  exportTxt: (path: string) => invoke<number>("export_txt", { path }),
  exportMd: (path: string, from: string | null, to: string | null) => invoke<void>("export_md", { path, from, to }),
};

export function errorText(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  return "Terjadi kesalahan";
}
