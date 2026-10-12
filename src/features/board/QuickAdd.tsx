import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { errorText } from "../../lib/api";
import { autoTags } from "../../lib/tags";
import { splitTitle } from "../../lib/title";
import { useNotes } from "../../store/notes";

/** Inline input on top of the Todo column. Enter saves with auto tags. */
export function QuickAdd() {
  const save = useNotes((s) => s.save);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const value = text.trim();
    if (!value) {
      setError("Tulis tugasnya dulu");
      return;
    }
    setBusy(true);
    try {
      const { title, body } = splitTitle(value);
      await save({ title, body, status: "todo", needsReview: false, dueAt: null, tags: autoTags(value), checklist: [] });
      setText("");
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-2">
      <label className="flex h-8 items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-2.5 text-zinc-400 transition-colors focus-within:border-solid focus-within:border-accent-500 focus-within:bg-white dark:border-zinc-700 dark:focus-within:bg-zinc-900">
        <Plus size={13} className="shrink-0" />
        <input
          value={text}
          disabled={busy}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
            if (e.key === "Escape") {
              setText("");
              setError(null);
              e.currentTarget.blur();
            }
          }}
          placeholder="Tambah tugas, Enter untuk simpan"
          className="h-full flex-1 bg-transparent text-[12.5px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
        />
      </label>
      {error && <p className="mt-1 px-1 text-[11.5px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
