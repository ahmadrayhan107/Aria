import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { UploadSimple } from "@phosphor-icons/react";
import { useNotes } from "../store/notes";
import { Board, BoardSkeleton } from "../features/board/Board";
import { DetailPanel } from "../features/detail/DetailPanel";
import { CommandPalette } from "../features/search/CommandPalette";
import { Archive } from "../features/archive/Archive";
import { ImportDialog } from "../features/import/ImportDialog";
import { ExportDialog } from "../features/import/ExportDialog";
import { Toast } from "../components/ui";
import { Sidebar } from "./Sidebar";
import { Titlebar } from "./Titlebar";

function EmptyState() {
  const setImport = useNotes((s) => s.setImport);
  return (
    <div className="flex flex-1 items-center px-16">
      <div className="max-w-[460px]">
        <p className="label text-accent-600 dark:text-accent-400">Mulai</p>
        <h1 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight">Pindahkan Notes.txt ke papan.</h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-zinc-500">
          Aria membaca bagian belum dikerjakan, sudah dikerjakan, Pending, dan Ongoing, lalu memberi tag proyek otomatis. Kamu bisa
          meninjau hasilnya sebelum disimpan.
        </p>
        <div className="mt-6 flex items-center gap-4">
          <button className="btn-primary h-8 px-3.5" onClick={() => setImport(true)}>
            <UploadSimple size={15} /> Impor Notes.txt
          </button>
          <span className="text-[12px] text-zinc-500">
            atau tekan <span className="kbd">Ctrl Alt N</span> untuk catat cepat
          </span>
        </div>
      </div>
    </div>
  );
}

function LoadError({ message }: { message: string }) {
  const load = useNotes((s) => s.load);
  return (
    <div className="flex flex-1 items-center px-16">
      <div className="max-w-[460px]">
        <h1 className="text-[16px] font-semibold">Database tidak bisa dibuka</h1>
        <p className="mt-2 font-mono text-[12px] text-red-600 dark:text-red-400">{message}</p>
        <button className="btn-outline mt-4" onClick={() => void load()}>
          Coba lagi
        </button>
      </div>
    </div>
  );
}

export function App() {
  const { loaded, loadError, notes, view, paletteOpen, importOpen, exportOpen, load, setPalette } = useNotes();

  useEffect(() => {
    void load();
    const un = listen("notes-changed", () => void load());
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(!useNotes.getState().paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      void un.then((f) => f());
      window.removeEventListener("keydown", onKey);
    };
  }, [load, setPalette]);

  let main: React.ReactNode;
  if (!loaded) main = <BoardSkeleton />;
  else if (loadError) main = <LoadError message={loadError} />;
  else if (notes.length === 0) main = <EmptyState />;
  else main = view === "board" ? <Board /> : <Archive />;

  return (
    <div className="flex h-full flex-col">
      <Titlebar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {main}
          <DetailPanel />
        </main>
      </div>
      {paletteOpen && <CommandPalette />}
      {importOpen && <ImportDialog />}
      {exportOpen && <ExportDialog />}
      <Toast />
    </div>
  );
}
