import { useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { FileMd, FileText } from "@phosphor-icons/react";
import { api, errorText } from "../../lib/api";
import { isoDay } from "../../lib/dates";
import { useNotes } from "../../store/notes";
import { Dialog } from "../../components/ui";

function monthStart(): string {
  const d = new Date();
  return isoDay(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function ExportDialog() {
  const { setExport, notify } = useNotes();
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [error, setError] = useState<string | null>(null);
  const close = () => setExport(false);

  const exportTxt = async () => {
    setError(null);
    try {
      const path = await save({ defaultPath: "Notes.txt", filters: [{ name: "Teks", extensions: ["txt"] }] });
      if (!path) return;
      const n = await api.exportTxt(path);
      notify(`${n} catatan diekspor ke ${path}`);
      close();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const exportMd = async () => {
    setError(null);
    if (from && to && from > to) {
      setError("Tanggal awal harus sebelum tanggal akhir");
      return;
    }
    try {
      const path = await save({
        defaultPath: `laporan-selesai-${from || "awal"}-${to || "kini"}.md`,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (!path) return;
      await api.exportMd(path, from || null, to || null);
      notify(`Laporan disimpan ke ${path}`);
      close();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <Dialog title="Ekspor" onClose={close}>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        <section className="grid grid-cols-[1fr_auto] items-center gap-4 p-4">
          <div>
            <h3 className="text-[13px] font-medium">Notes.txt</h3>
            <p className="mt-0.5 max-w-[46ch] text-[12.5px] leading-relaxed text-zinc-500">
              Tulis ulang semua catatan dalam format asli: empat bagian dengan urutan yang sama.
            </p>
          </div>
          <button className="btn-outline" onClick={exportTxt}>
            <FileText size={14} /> Simpan .txt
          </button>
        </section>
        <section className="grid gap-3 p-4">
          <div>
            <h3 className="text-[13px] font-medium">Laporan pekerjaan selesai</h3>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-zinc-500">Markdown berisi item Selesai per tanggal, untuk laporan ke atasan.</p>
          </div>
          <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <label className="grid gap-1.5">
              <span className="label">Dari</span>
              <input type="date" className="field font-mono" value={from} onChange={(e) => setFrom(e.target.value)} aria-invalid={!!error} />
            </label>
            <label className="grid gap-1.5">
              <span className="label">Sampai</span>
              <input type="date" className="field font-mono" value={to} onChange={(e) => setTo(e.target.value)} aria-invalid={!!error} />
            </label>
            <button className="btn-outline h-[30px]" onClick={exportMd}>
              <FileMd size={14} /> Simpan .md
            </button>
          </div>
          <p className="text-[11.5px] text-zinc-400">Kosongkan kedua tanggal untuk menyertakan semua item, termasuk hasil impor tanpa tanggal.</p>
        </section>
        {error && <p className="px-4 py-3 text-[12.5px] text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </Dialog>
  );
}
