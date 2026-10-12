import { useEffect, useRef, useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Check, ClipboardText, Plus, Trash, WarningCircle, X } from "@phosphor-icons/react";
import { errorText } from "../../lib/api";
import { fullDate } from "../../lib/dates";
import { toPrompt } from "../../lib/prompt";
import { normalizeTag } from "../../lib/tags";
import { STATUSES, STATUS_LABEL, toInput, type Note, type NoteInput } from "../../lib/types";
import { useNotes } from "../../store/notes";
import { useTagColor } from "../../components/ui";

type SaveState = "idle" | "saving" | "saved" | "error";

function AutoTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} />;
}

function Editor({ note }: { note: Note }) {
  const save = useNotes((s) => s.save);
  const remove = useNotes((s) => s.remove);
  const select = useNotes((s) => s.select);
  const notify = useNotes((s) => s.notify);
  const allTags = useNotes((s) => s.tags);
  const colorOf = useTagColor();

  const [draft, setDraft] = useState<NoteInput>(() => toInput(note));
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [tagText, setTagText] = useState("");
  const [itemText, setItemText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = useRef(false);

  const patch = (p: Partial<NoteInput>) => {
    dirty.current = true;
    setDraft((d) => ({ ...d, ...p }));
  };

  useEffect(() => {
    if (!dirty.current) return;
    if (!draft.title.trim()) {
      setError("Judul wajib diisi");
      return;
    }
    setError(null);
    const t = setTimeout(async () => {
      setState("saving");
      try {
        await save(draft);
        dirty.current = false;
        setState("saved");
      } catch (e) {
        setState("error");
        setError(errorText(e));
      }
    }, 450);
    return () => clearTimeout(t);
  }, [draft, save]);

  const addTag = () => {
    const t = normalizeTag(tagText);
    if (t && !draft.tags.includes(t)) patch({ tags: [...draft.tags, t] });
    setTagText("");
  };
  const addItem = () => {
    const t = itemText.trim();
    if (t) patch({ checklist: [...draft.checklist, { text: t, done: false }] });
    setItemText("");
  };

  const copyPrompt = async () => {
    try {
      await writeText(toPrompt(draft));
      notify("Prompt disalin ke clipboard");
    } catch (e) {
      notify(errorText(e), "error");
    }
  };

  const doDelete = async () => {
    try {
      await remove(note.id);
      notify("Catatan dihapus");
    } catch (e) {
      notify(errorText(e), "error");
    }
  };

  const done = draft.checklist.filter((c) => c.done).length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-zinc-100 px-4 dark:border-zinc-800">
        <span className="font-mono text-[11px] text-zinc-400">#{note.id}</span>
        <span className="font-mono text-[11px] text-zinc-400">
          {state === "saving" ? "Menyimpan" : state === "saved" ? "Tersimpan" : state === "error" ? "Gagal simpan" : ""}
        </span>
        <button className="btn-ghost ml-auto h-6 px-1" onClick={() => select(null)} aria-label="Tutup panel">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {draft.needsReview && (
          <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12.5px] text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
            <WarningCircle size={16} className="mt-px shrink-0" />
            <div className="flex-1">
              <p className="font-medium">Perlu review</p>
              <p className="mt-0.5 leading-relaxed opacity-80">{note.reviewReason ?? "Periksa apakah item ini ada di kolom yang benar."}</p>
              <button className="btn-outline mt-2 h-6 text-[12px]" onClick={() => patch({ needsReview: false })}>
                <Check size={12} /> Tandai sudah direview
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-1.5">
          <AutoTextarea
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value.replace(/\n/g, " ") })}
            aria-label="Judul"
            aria-invalid={!!error}
            className={`w-full resize-none bg-transparent text-[16px] font-semibold leading-snug tracking-tight focus:outline-none ${
              error ? "rounded-md ring-1 ring-red-500" : ""
            }`}
          />
          {error && <p className="text-[11.5px] text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="grid gap-1.5">
          <span className="label">Status</span>
          <div className="grid grid-cols-4 rounded-md border border-zinc-200 p-0.5 dark:border-zinc-800">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => patch({ status: s })}
                className={`h-6 rounded text-[12px] transition-colors active:scale-[0.98] ${
                  draft.status === s
                    ? "bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <label className="grid gap-1.5">
            <span className="label">Tenggat</span>
            <input type="date" className="field font-mono" value={draft.dueAt ?? ""} onChange={(e) => patch({ dueAt: e.target.value || null })} />
          </label>
          {draft.dueAt && (
            <button className="btn-ghost h-[30px]" onClick={() => patch({ dueAt: null })}>
              Hapus tenggat
            </button>
          )}
        </div>

        <div className="grid gap-1.5">
          <span className="label">Proyek</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {draft.tags.map((t) => (
              <span key={t} className="inline-flex h-6 items-center gap-1.5 rounded-md border border-zinc-200 pl-2 pr-1 text-[12px] dark:border-zinc-800">
                <span className="size-1.5 rounded-full" style={{ background: colorOf(t) ?? "#71717a" }} />
                {t}
                <button onClick={() => patch({ tags: draft.tags.filter((x) => x !== t) })} aria-label={`Hapus tag ${t}`} className="rounded p-0.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
                  <X size={10} />
                </button>
              </span>
            ))}
            <input
              list="tag-options"
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTag()}
              onBlur={addTag}
              placeholder="Tambah tag"
              className="h-6 w-28 bg-transparent text-[12px] placeholder:text-zinc-400 focus:outline-none"
            />
            <datalist id="tag-options">
              {allTags.filter((t) => !draft.tags.includes(t.name)).map((t) => (
                <option key={t.id} value={t.name} />
              ))}
            </datalist>
          </div>
        </div>

        <label className="grid gap-1.5">
          <span className="label">Catatan</span>
          <AutoTextarea
            value={draft.body}
            onChange={(e) => patch({ body: e.target.value })}
            placeholder="Detail, konteks, atau langkah kerja"
            className="field min-h-24 resize-none leading-relaxed"
          />
        </label>

        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <span className="label">Checklist</span>
            {draft.checklist.length > 0 && (
              <span className="font-mono text-[11px] text-zinc-400">
                {done}/{draft.checklist.length}
              </span>
            )}
          </div>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {draft.checklist.map((c, i) => (
              <li key={i} className="group flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  checked={c.done}
                  onChange={() => patch({ checklist: draft.checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })}
                  className="size-3.5 accent-[var(--color-accent-600)]"
                />
                <input
                  value={c.text}
                  onChange={(e) => patch({ checklist: draft.checklist.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
                  className={`flex-1 bg-transparent text-[12.5px] focus:outline-none ${c.done ? "text-zinc-400 line-through" : ""}`}
                />
                <button
                  onClick={() => patch({ checklist: draft.checklist.filter((_, j) => j !== i) })}
                  className="text-zinc-400 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                  aria-label="Hapus item"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
          <label className="flex h-7 items-center gap-2 text-zinc-400">
            <Plus size={12} />
            <input
              value={itemText}
              onChange={(e) => setItemText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              placeholder="Tambah langkah"
              className="flex-1 bg-transparent text-[12.5px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
            />
          </label>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-zinc-100 pt-4 text-[12px] dark:border-zinc-800">
          <dt className="text-zinc-500">Dibuat</dt>
          <dd className="font-mono text-zinc-600 dark:text-zinc-400">{fullDate(note.createdAt)}</dd>
          <dt className="text-zinc-500">Diperbarui</dt>
          <dd className="font-mono text-zinc-600 dark:text-zinc-400">{fullDate(note.updatedAt)}</dd>
          {note.doneAt && (
            <>
              <dt className="text-zinc-500">Selesai</dt>
              <dd className="font-mono text-zinc-600 dark:text-zinc-400">{fullDate(note.doneAt)}</dd>
            </>
          )}
          {note.sourceLine != null && (
            <>
              <dt className="text-zinc-500">Baris Notes.txt</dt>
              <dd className="font-mono text-zinc-600 dark:text-zinc-400">{note.sourceLine}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <button className="btn-primary" onClick={copyPrompt}>
          <ClipboardText size={14} /> Salin sebagai prompt
        </button>
        {confirmDelete ? (
          <div className="ml-auto flex items-center gap-1">
            <button className="btn h-7 bg-red-600 text-white hover:bg-red-700" onClick={doDelete}>
              Ya, hapus
            </button>
            <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>
              Batal
            </button>
          </div>
        ) : (
          <button className="btn-ghost ml-auto hover:text-red-600" onClick={() => setConfirmDelete(true)}>
            <Trash size={14} /> Hapus
          </button>
        )}
      </div>
    </div>
  );
}

export function DetailPanel() {
  const note = useNotes((s) => s.notes.find((n) => n.id === s.selectedId));
  const select = useNotes((s) => s.select);

  useEffect(() => {
    if (!note) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "Escape" && !["INPUT", "TEXTAREA"].includes(target.tagName)) select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [note, select]);

  return (
    <aside
      className={`absolute inset-y-0 right-0 z-20 w-[400px] border-l border-zinc-200 bg-white shadow-[-24px_0_48px_-32px_rgba(24,24,27,0.3)] transition-transform duration-200 ease-out-quint dark:border-zinc-800 dark:bg-zinc-900 ${
        note ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
      aria-hidden={!note}
    >
      {note && <Editor key={note.id} note={note} />}
    </aside>
  );
}
