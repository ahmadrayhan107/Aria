import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarBlank, CheckSquare } from "@phosphor-icons/react";
import type { Note } from "../../lib/types";
import { dueState, shortDate } from "../../lib/dates";
import { ReviewBadge, TagDot } from "../../components/ui";

const DUE_TONE = {
  overdue: "text-red-600 dark:text-red-400",
  today: "text-amber-700 dark:text-amber-400",
  soon: "text-amber-700/80 dark:text-amber-400/80",
  later: "text-zinc-500",
} as const;

interface CardProps {
  note: Note;
  selected?: boolean;
  colorOf: (tag: string) => string | undefined;
  onOpen?: (id: number) => void;
  overlay?: boolean;
}

export const CardBody = memo(function CardBody({ note, selected, colorOf, overlay }: Omit<CardProps, "onOpen">) {
  const done = note.checklist.filter((c) => c.done).length;
  const hasMeta = note.tags.length > 0 || note.dueAt || note.checklist.length > 0 || note.needsReview;
  return (
    <div
      className={`rounded-lg border bg-white px-3 py-2.5 transition-[border-color,box-shadow] dark:bg-zinc-900 ${
        selected
          ? "border-accent-500 shadow-[0_0_0_1px_var(--color-accent-500)]"
          : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
      } ${overlay ? "rotate-[0.8deg] shadow-[0_16px_32px_-16px_rgba(24,24,27,0.4)]" : ""} ${
        note.status === "done" ? "text-zinc-500 dark:text-zinc-400" : ""
      }`}
    >
      <p className="line-clamp-3 text-[13px] leading-[1.45]">{note.title}</p>
      {hasMeta && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {note.needsReview && <ReviewBadge title={note.reviewReason} />}
          {note.tags.map((t) => (
            <TagDot key={t} name={t} color={colorOf(t)} />
          ))}
          {note.dueAt && note.status !== "done" && (
            <span className={`inline-flex items-center gap-1 font-mono text-[11px] ${DUE_TONE[dueState(note.dueAt)]}`}>
              <CalendarBlank size={12} />
              {shortDate(note.dueAt)}
            </span>
          )}
          {note.checklist.length > 0 && (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-500">
              <CheckSquare size={12} />
              {done}/{note.checklist.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

export function SortableCard({ note, selected, colorOf, onOpen }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
    data: { status: note.status },
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`list-none outline-none active:scale-[0.99] ${isDragging ? "opacity-30" : ""}`}
      onClick={() => onOpen?.(note.id)}
      onKeyDown={(e) => e.key === "Enter" && onOpen?.(note.id)}
      {...attributes}
      {...listeners}
    >
      <CardBody note={note} selected={selected} colorOf={colorOf} />
    </li>
  );
}
