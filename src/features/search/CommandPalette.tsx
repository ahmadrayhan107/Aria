import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, DownloadSimple, Kanban, MagnifyingGlass, Monitor, Moon, Sun, UploadSimple } from "@phosphor-icons/react";
import { api, errorText } from "../../lib/api";
import { STATUS_LABEL, type Note } from "../../lib/types";
import { useNotes } from "../../store/notes";
import { setTheme } from "../../lib/theme";

interface Action {
  id: string;
  label: string;
  icon: React.ReactNode;
  run: () => void;
}

export function CommandPalette() {
  const { setPalette, select, setView, setImport, setExport, notes } = useNotes();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Note[]>([]);
  const [ms, setMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const close = () => setPalette(false);

  const actions: Action[] = useMemo(
    () => [
      { id: "board", label: "Buka papan", icon: <Kanban size={15} />, run: () => setView("board") },
      { id: "archive", label: "Buka arsip selesai", icon: <Archive size={15} />, run: () => setView("archive") },
      { id: "import", label: "Impor Notes.txt", icon: <UploadSimple size={15} />, run: () => setImport(true) },
      { id: "export", label: "Ekspor Notes.txt atau laporan", icon: <DownloadSimple size={15} />, run: () => setExport(true) },
      { id: "theme-light", label: "Tema terang", icon: <Sun size={15} />, run: () => setTheme("light") },
      { id: "theme-dark", label: "Tema gelap", icon: <Moon size={15} />, run: () => setTheme("dark") },
      { id: "theme-system", label: "Tema ikuti sistem", icon: <Monitor size={15} />, run: () => setTheme("system") },
    ],
    [setView, setImport, setExport],
  );

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setHits([]);
      setMs(null);
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      const start = performance.now();
      try {
        const ids = await api.search(query);
        if (!live) return;
        const byId = new Map(useNotes.getState().notes.map((n) => [n.id, n]));
        setHits(ids.map((id) => byId.get(id)).filter((n): n is Note => !!n));
        setMs(performance.now() - start);
        setError(null);
        setCursor(0);
      } catch (e) {
        if (live) setError(errorText(e));
      }
    }, 60);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, notes]);

  const filteredActions = q.trim() ? actions.filter((a) => a.label.toLowerCase().includes(q.trim().toLowerCase())) : actions;
  const total = hits.length + filteredActions.length;

  const runAt = (i: number) => {
    const note = hits[i];
    if (note) {
      setView(note.status === "done" && note.doneAt ? "archive" : "board");
      select(note.id);
    } else filteredActions[i - hits.length]?.run();
    close();
  };

  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (total ? (c + 1) % total : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (total ? (c - 1 + total) % total : 0));
    } else if (e.key === "Enter" && total) runAt(cursor);
  };

  const row = (i: number) =>
    `flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] ${
      i === cursor ? "bg-zinc-100 dark:bg-zinc-800" : ""
    }`;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-zinc-950/25 pt-[14vh] dark:bg-black/50" onMouseDown={close}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-[620px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_24px_48px_-24px_rgba(24,24,27,0.35)] dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex h-12 items-center gap-2.5 border-b border-zinc-100 px-4 dark:border-zinc-800">
          <MagnifyingGlass size={16} className="text-zinc-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Cari di semua catatan, termasuk yang selesai"
            className="h-full flex-1 bg-transparent text-[14px] placeholder:text-zinc-400 focus:outline-none"
          />
          {ms != null && <span className="font-mono text-[11px] text-zinc-400">{hits.length} hasil · {ms.toFixed(0)} ms</span>}
        </div>
        <ul ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
          {error && <li className="px-2.5 py-2 text-[12.5px] text-red-600">{error}</li>}
          {q.trim() && !error && hits.length === 0 && ms != null && (
            <li className="px-2.5 py-3 text-[12.5px] text-zinc-500">Tidak ada catatan yang cocok dengan "{q.trim()}".</li>
          )}
          {hits.map((n, i) => (
            <li key={n.id} data-i={i}>
              <button className={row(i)} onMouseMove={() => setCursor(i)} onClick={() => runAt(i)}>
                <span className="w-16 shrink-0 font-mono text-[10.5px] uppercase tracking-wide text-zinc-400">{STATUS_LABEL[n.status]}</span>
                <span className="min-w-0 flex-1 truncate">{n.title}</span>
                {n.tags[0] && <span className="shrink-0 text-[11.5px] text-zinc-400">{n.tags.join(", ")}</span>}
              </button>
            </li>
          ))}
          {filteredActions.length > 0 && (
            <li className="label px-2.5 pb-1 pt-2.5">Perintah</li>
          )}
          {filteredActions.map((a, j) => {
            const i = hits.length + j;
            return (
              <li key={a.id} data-i={i}>
                <button className={row(i)} onMouseMove={() => setCursor(i)} onClick={() => runAt(i)}>
                  <span className="text-zinc-400">{a.icon}</span>
                  {a.label}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex gap-3 border-t border-zinc-100 px-4 py-2 text-[11px] text-zinc-400 dark:border-zinc-800">
          <span><span className="kbd">Enter</span> buka</span>
          <span><span className="kbd">↑ ↓</span> pilih</span>
          <span><span className="kbd">Esc</span> tutup</span>
        </div>
      </div>
    </div>
  );
}
