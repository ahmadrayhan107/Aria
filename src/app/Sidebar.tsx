import { useMemo } from "react";
import { Archive, DownloadSimple, Kanban, UploadSimple, WarningCircle } from "@phosphor-icons/react";
import { REVIEW_FILTER, useNotes, type Filter } from "../store/notes";

function Row({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-[12.5px] transition-colors active:scale-[0.99] ${
        active
          ? "bg-white font-medium text-zinc-900 shadow-[0_0_0_1px_rgba(24,24,27,0.06)] dark:bg-zinc-800 dark:text-zinc-50 dark:shadow-none"
          : "text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-900"
      }`}
    >
      {children}
      {count !== undefined && <span className="ml-auto font-mono text-[11px] text-zinc-400">{count}</span>}
    </button>
  );
}

export function Sidebar() {
  const { notes, tags, view, filter, setView, setFilter, setImport, setExport } = useNotes();

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of notes) {
      if (n.status === "done") continue;
      for (const t of n.tags) m.set(t, (m.get(t) ?? 0) + 1);
    }
    return m;
  }, [notes]);
  const open = notes.filter((n) => n.status !== "done").length;
  const review = notes.filter((n) => n.needsReview).length;
  const toggle = (f: Filter) => setFilter(filter === f ? null : f);

  return (
    <aside className="flex w-[208px] shrink-0 flex-col border-r border-zinc-200 bg-zinc-100/60 px-2.5 py-3 dark:border-zinc-800/80 dark:bg-zinc-950">
      <nav className="space-y-0.5">
        <Row active={view === "board"} onClick={() => setView("board")} count={open}>
          <Kanban size={15} /> Papan
        </Row>
        <Row active={view === "archive"} onClick={() => setView("archive")} count={notes.length - open}>
          <Archive size={15} /> Arsip selesai
        </Row>
      </nav>

      <div className="mt-5 mb-1.5 flex items-center justify-between px-2">
        <span className="label">Proyek</span>
        {filter && (
          <button className="text-[11px] text-accent-600 hover:underline dark:text-accent-400" onClick={() => setFilter(null)}>
            Reset
          </button>
        )}
      </div>
      <div className="-mr-1 flex-1 space-y-0.5 overflow-y-auto pr-1">
        {review > 0 && (
          <Row active={filter === REVIEW_FILTER} onClick={() => toggle(REVIEW_FILTER)} count={review}>
            <WarningCircle size={14} className="text-amber-600 dark:text-amber-400" /> Perlu review
          </Row>
        )}
        {tags.map((t) => (
          <Row key={t.id} active={filter === t.name} onClick={() => toggle(t.name)} count={counts.get(t.name) ?? 0}>
            <span className="ml-[3px] mr-[2px] size-2 rounded-full" style={{ background: t.color }} />
            <span className="truncate">{t.name}</span>
          </Row>
        ))}
        {tags.length === 0 && <p className="px-2 text-[12px] leading-relaxed text-zinc-400">Tag muncul otomatis saat impor atau saat kamu menambah tag di kartu.</p>}
      </div>

      <div className="mt-3 space-y-0.5 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <Row active={false} onClick={() => setImport(true)}>
          <UploadSimple size={15} /> Impor Notes.txt
        </Row>
        <Row active={false} onClick={() => setExport(true)}>
          <DownloadSimple size={15} /> Ekspor
        </Row>
      </div>
    </aside>
  );
}
