import { useMemo, useState } from "react";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { shortDate, type Grouping } from "../../lib/dates";
import { groupDone } from "../../lib/archive";
import { matchesFilter, useNotes } from "../../store/notes";
import { ReviewBadge, TagDot, useTagColor } from "../../components/ui";

export function Archive() {
  const notes = useNotes((s) => s.notes);
  const filter = useNotes((s) => s.filter);
  const select = useNotes((s) => s.select);
  const selectedId = useNotes((s) => s.selectedId);
  const move = useNotes((s) => s.move);
  const colorOf = useTagColor();
  const [by, setBy] = useState<Grouping>("week");

  const done = useMemo(() => notes.filter((n) => n.status === "done" && matchesFilter(n, filter)), [notes, filter]);
  const groups = useMemo(() => groupDone(done, by), [done, by]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 px-6 pb-3 pt-4">
        <h1 className="text-[15px] font-semibold tracking-tight">Arsip selesai</h1>
        <span className="font-mono text-[11.5px] text-zinc-400">{done.length} item</span>
        <div className="ml-auto grid grid-cols-2 rounded-md border border-zinc-200 p-0.5 dark:border-zinc-800">
          {(["week", "month"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setBy(g)}
              className={`h-6 rounded px-3 text-[12px] transition-colors ${
                by === g ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {g === "week" ? "Per minggu" : "Per bulan"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 pb-10">
        {groups.length === 0 && <p className="max-w-[48ch] py-10 text-[13px] leading-relaxed text-zinc-500">Belum ada pekerjaan selesai untuk filter ini. Seret kartu ke kolom Selesai di papan; tanggal selesai tercatat otomatis.</p>}
        {groups.map((g) => (
          <section key={g.key} className="mb-6 max-w-[880px]">
            <h2 className="sticky top-0 z-10 flex items-baseline gap-2 bg-zinc-50/95 py-2 text-[12.5px] font-semibold backdrop-blur dark:bg-zinc-950/95">
              {g.label}
              <span className="font-mono text-[11px] font-normal text-zinc-400">{g.notes.length}</span>
            </h2>
            <ul className="divide-y divide-zinc-200/70 border-y border-zinc-200/70 dark:divide-zinc-800 dark:border-zinc-800">
              {g.notes.map((n) => (
                <li
                  key={n.id}
                  onClick={() => select(n.id)}
                  className={`group grid cursor-default grid-cols-[1fr_auto_auto] items-center gap-4 px-2 py-2 transition-colors hover:bg-white dark:hover:bg-zinc-900 ${
                    selectedId === n.id ? "bg-white dark:bg-zinc-900" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px]">{n.title}</p>
                    {(n.tags.length > 0 || n.needsReview) && (
                      <div className="mt-0.5 flex gap-2.5">
                        {n.needsReview && <ReviewBadge title={n.reviewReason} />}
                        {n.tags.map((t) => (
                          <TagDot key={t} name={t} color={colorOf(t)} />
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-zinc-400">{n.doneAt ? shortDate(n.doneAt) : ""}</span>
                  <button
                    title="Kembalikan ke Todo"
                    className="btn-ghost h-6 px-1.5 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      void move(n.id, "todo", 0);
                    }}
                  >
                    <ArrowCounterClockwise size={13} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
