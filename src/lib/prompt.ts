import type { Note } from "./types";

/** Markdown for pasting into Claude Code: title, body, then checklist. */
export function toPrompt(n: Pick<Note, "title" | "body" | "checklist" | "tags" | "dueAt">): string {
  const parts = [`# ${n.title.trim()}`];
  if (n.body.trim()) parts.push(n.body.trim());
  if (n.checklist.length) {
    parts.push(n.checklist.map((c) => `- [${c.done ? "x" : " "}] ${c.text.trim()}`).join("\n"));
  }
  const meta: string[] = [];
  if (n.tags.length) meta.push(`Proyek: ${n.tags.join(", ")}`);
  if (n.dueAt) meta.push(`Tenggat: ${n.dueAt}`);
  if (meta.length) parts.push(meta.join("\n"));
  return parts.join("\n\n") + "\n";
}
