export type Status = "todo" | "ongoing" | "pending" | "done";

export const STATUSES: Status[] = ["todo", "ongoing", "pending", "done"];

export const STATUS_LABEL: Record<Status, string> = {
  todo: "Todo",
  ongoing: "Ongoing",
  pending: "Pending",
  done: "Selesai",
};

export interface ChecklistItem {
  id?: number | null;
  text: string;
  done: boolean;
}

export interface Note {
  id: number;
  title: string;
  body: string;
  status: Status;
  position: number;
  needsReview: boolean;
  reviewReason: string | null;
  createdAt: string;
  updatedAt: string;
  doneAt: string | null;
  dueAt: string | null;
  sourceLine: number | null;
  tags: string[];
  checklist: ChecklistItem[];
}

export interface NoteInput {
  id?: number | null;
  title: string;
  body: string;
  status: Status;
  needsReview: boolean;
  dueAt: string | null;
  tags: string[];
  checklist: ChecklistItem[];
}

export interface Tag {
  id: number;
  name: string;
  color: string;
}

/** Item from `import_preview` (Rust snake_case). */
export interface ParsedNote {
  title: string;
  body: string;
  status: Status;
  needs_review: boolean;
  review_reason: string | null;
  source_line: number;
  tags: string[];
}

export function toInput(n: Note): NoteInput {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    status: n.status,
    needsReview: n.needsReview,
    dueAt: n.dueAt,
    tags: n.tags,
    checklist: n.checklist,
  };
}
