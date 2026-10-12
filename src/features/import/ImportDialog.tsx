import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FileText } from "@phosphor-icons/react";
import { api, errorText } from "../../lib/api";
import { STATUSES, STATUS_LABEL, type ParsedNote } from "../../lib/types";
import { useNotes } from "../../store/notes";
import { Dialog, ReviewBadge } from "../../components/ui";

export function ImportDialog() {
  const { setImport, load, notify, notes } = useNotes();
  const [path, setPath] = useState<string | null>(null);
  const [items, setItems] = useState<ParsedNote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [replace, setReplace] = useState(notes.length === 0);
  const close = () => setImport(false);

  const pick = async () => {
    setError(null);
    try {
      const file = await open({ multiple: false, filters: [{ name: "Teks", extensions: ["txt", "md"] }] });
      if (typeof file !== "string") return;
      setPath(file);
      setItems(await api.importPreview(file));
    } catch (e) {
      setItems(null);
      setError(errorText(e));
    }
  };

  const commit = async () => {
    if (!items) return;
    setBusy(true);
    try {
      const n = await api.importCommit(items, replace);
      await load();
      notify(`${n} catatan diimpor`);
      close();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const review = items?.filter((i) => i.needs_review) ?? [];

  return (
    <Dialog title="Impor Notes.txt" onClose={close} width="max-w-[640px]">
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <button className="btn-outline" onClick={pick}>
            <FileText size={14} /> {path ? "Ganti file" : "Pilih file"}
          </button>
          <span className="min-w-0 truncate font-mono text-[11.5px] text-zinc-500">{path ?? "Belum ada file dipilih"}</span>
        </div>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-[12.5px] text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}

        {items && (
          <>
            <dl className="grid grid-cols-4 divide-x divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {STATUSES.map((s) => (
                <div key={s} className="px-3 py-2">
                  <dt className="label">{STATUS_LABEL[s]}</dt>
                  <dd className="mt-0.5 font-mono text-[18px] font-medium">{items.filter((i) => i.status === s).length}</dd>
                </div>
              ))}
            </dl>

            {review.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[12.5px] font-medium">{review.length} item ditandai perlu review</p>
                <ul className="max-h-48 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {review.map((i) => (
                    <li key={i.source_line} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-3 py-2">
                      <span className="row-span-2 pt-px font-mono text-[11px] text-zinc-400">L{i.source_line}</span>
                      <p className="truncate text-[12.5px]">{i.title}</p>
                      <div className="flex items-center gap-2 text-[11.5px] text-zinc-500">
                        <ReviewBadge /> {i.review_reason}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <fieldset className="grid gap-1.5">
              <legend className="label mb-1.5">Data yang sudah ada ({notes.length} catatan)</legend>
              <label className="flex items-center gap-2 text-[12.5px]">
                <input type="radio" checked={replace} onChange={() => setReplace(true)} className="accent-[var(--color-accent-600)]" />
                Ganti semua catatan dengan isi file
              </label>
              <label className="flex items-center gap-2 text-[12.5px]">
                <input type="radio" checked={!replace} onChange={() => setReplace(false)} className="accent-[var(--color-accent-600)]" />
                Tambahkan ke catatan yang ada
              </label>
            </fieldset>
          </>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <button className="btn-ghost" onClick={close}>
          Batal
        </button>
        <button className="btn-primary" disabled={!items || busy} onClick={commit}>
          {busy ? "Mengimpor" : items ? `Impor ${items.length} item` : "Impor"}
        </button>
      </div>
    </Dialog>
  );
}
