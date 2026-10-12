import { useMemo, useState } from "react";
import {
  closestCorners,
  DndContext,
  pointerWithin,
  type CollisionDetection,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { STATUSES, STATUS_LABEL, type Note, type Status } from "../../lib/types";
import { fullIndex } from "../../lib/reorder";
import { byPosition, matchesFilter, useNotes } from "../../store/notes";
import { useTagColor } from "../../components/ui";
import { CardBody, SortableCard } from "./NoteCard";
import { QuickAdd } from "./QuickAdd";

type Columns = Record<Status, number[]>;

/** Done can hold hundreds of cards; the board shows the top slice, the archive shows all. */
const DONE_LIMIT = 40;

function Column({
  status,
  ids,
  byId,
  hidden,
}: {
  status: Status;
  ids: number[];
  byId: Map<number, Note>;
  hidden: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}`, data: { status } });
  const selectedId = useNotes((s) => s.selectedId);
  const select = useNotes((s) => s.select);
  const setView = useNotes((s) => s.setView);
  const colorOf = useTagColor();
  return (
    <section className="flex min-h-0 min-w-0 flex-col">
      <header className="flex h-8 items-center gap-2 px-1">
        <h2 className="text-[12.5px] font-semibold tracking-tight">{STATUS_LABEL[status]}</h2>
        <span className="font-mono text-[11px] text-zinc-400">{ids.length + hidden}</span>
      </header>
      {status === "todo" && <QuickAdd />}
      <SortableContext id={status} items={ids} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className={`-mx-1 flex min-h-24 flex-1 flex-col gap-1.5 overflow-y-auto rounded-lg px-1 pb-6 pt-0.5 transition-colors ${
            isOver ? "bg-accent-50/60 dark:bg-accent-500/5" : ""
          }`}
        >
          {ids.map((id) => {
            const n = byId.get(id);
            return n ? <SortableCard key={id} note={n} selected={selectedId === id} colorOf={colorOf} onOpen={select} /> : null;
          })}
          {ids.length === 0 && (
            <li className="grid h-20 list-none place-items-center rounded-lg border border-dashed border-zinc-200 text-[12px] text-zinc-400 dark:border-zinc-800">
              Seret kartu ke sini
            </li>
          )}
          {hidden > 0 && (
            <li className="list-none pt-1">
              <button className="btn-ghost w-full justify-center text-[12px]" onClick={() => setView("archive")}>
                {hidden} lainnya di Arsip
              </button>
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  );
}

/** Pointer position wins (tall empty columns lose to small cards under closestCorners); corners as fallback for keyboard drags. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (!hits.length) return closestCorners(args);
  // Prefer a card under the pointer over the column that contains it.
  const card = hits.find((h) => typeof h.id === "number");
  return card ? [card] : hits;
};

function containerOf(cols: Columns, id: string | number): Status | undefined {
  if (typeof id === "string" && id.startsWith("col:")) return id.slice(4) as Status;
  return STATUSES.find((s) => cols[s].includes(id as number));
}

export function Board() {
  const notes = useNotes((s) => s.notes);
  const filter = useNotes((s) => s.filter);
  const move = useNotes((s) => s.move);
  const colorOf = useTagColor();
  const [dragCols, setDragCols] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);

  const byId = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);
  const { base, hidden } = useMemo(() => {
    const base = {} as Columns;
    const hidden = {} as Record<Status, number>;
    for (const s of STATUSES) {
      const ids = notes.filter((n) => n.status === s && matchesFilter(n, filter)).sort(byPosition).map((n) => n.id);
      base[s] = s === "done" ? ids.slice(0, DONE_LIMIT) : ids;
      hidden[s] = ids.length - base[s].length;
    }
    return { base, hidden };
  }, [notes, filter]);
  const cols = dragCols ?? base;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as number);
    setDragCols(base);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || !dragCols) return;
    const from = containerOf(dragCols, active.id);
    const to = containerOf(dragCols, over.id);
    if (!from || !to || from === to) return;
    const id = active.id as number;
    const target = dragCols[to].filter((x) => x !== id);
    const overIndex = target.indexOf(over.id as number);
    target.splice(overIndex >= 0 ? overIndex : target.length, 0, id);
    setDragCols({ ...dragCols, [from]: dragCols[from].filter((x) => x !== id), [to]: target });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const cur = dragCols;
    setActiveId(null);
    setDragCols(null);
    if (!over || !cur) return;
    const id = active.id as number;
    const status = containerOf(cur, active.id);
    if (!status) return;
    let visible = cur[status];
    const overIdx = visible.indexOf(over.id as number);
    const fromIdx = visible.indexOf(id);
    if (overIdx >= 0 && overIdx !== fromIdx) visible = arrayMove(visible, fromIdx, overIdx);

    // Map the visible index back to the full column (filters may hide cards).
    const full = notes.filter((n) => n.status === status && n.id !== id).sort(byPosition).map((n) => n.id);
    const index = fullIndex(visible, id, full, status === "done");

    if (byId.get(id)?.status === status) {
      const before = notes.filter((n) => n.status === status).sort(byPosition).map((n) => n.id);
      if (before.indexOf(id) === index) return;
    }
    void move(id, status, index);
  };

  const active = activeId != null ? byId.get(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setDragCols(null);
      }}
    >
      <div className="grid min-h-0 flex-1 grid-cols-[1.3fr_1.3fr_1fr_1fr] gap-4 px-5 pt-3">
        {STATUSES.map((s) => (
          <Column key={s} status={s} ids={cols[s]} byId={byId} hidden={hidden[s]} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
        {active ? <CardBody note={active} colorOf={colorOf} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

export function BoardSkeleton() {
  return (
    <div className="grid flex-1 grid-cols-[1.3fr_1.3fr_1fr_1fr] gap-4 px-5 pt-3">
      {[5, 3, 2, 4].map((n, c) => (
        <div key={c} className="space-y-1.5">
          <div className="skeleton mb-3 mt-2 h-3.5 w-20" />
          {Array.from({ length: n }, (_, i) => (
            <div key={i} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="skeleton h-3 w-[85%]" />
              <div className="skeleton mt-2 h-3 w-[55%]" />
              <div className="skeleton mt-3 h-2.5 w-16" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
