import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Lightning } from "@phosphor-icons/react";
import { api, errorText } from "../../lib/api";
import { autoTags } from "../../lib/tags";
import { splitTitle } from "../../lib/title";

/** Small always-on-top window opened by Ctrl+Alt+N. Enter saves to Todo, Esc closes. */
export function Capture() {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focus = () => {
      setSaved(false);
      setError(null);
      input.current?.focus();
    };
    focus();
    const un = listen("capture-open", focus);
    const onBlur = () => void getCurrentWindow().close();
    window.addEventListener("blur", onBlur);
    return () => {
      void un.then((f) => f());
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const submit = async () => {
    const value = text.trim();
    if (!value) {
      setError("Tulis tugasnya dulu");
      return;
    }
    try {
      const { title, body } = splitTitle(value);
      await api.upsert({ title, body, status: "todo", needsReview: false, dueAt: null, tags: autoTags(value), checklist: [] });
      setText("");
      setSaved(true);
      setTimeout(() => void getCurrentWindow().close(), 450);
    } catch (e) {
      setError(errorText(e));
    }
  };

  const tags = autoTags(text);

  return (
    <div data-tauri-drag-region className="flex h-full flex-col justify-center gap-2 border border-zinc-300 bg-white px-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center gap-2.5">
        <Lightning size={18} className="shrink-0 text-accent-600 dark:text-accent-400" />
        <input
          ref={input}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
            setSaved(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
            if (e.key === "Escape") void getCurrentWindow().close();
          }}
          aria-invalid={!!error}
          placeholder="Catat tugas baru ke Todo"
          className="h-10 flex-1 bg-transparent text-[16px] placeholder:text-zinc-400 focus:outline-none"
        />
      </div>
      <div className="flex h-4 items-center gap-3 pl-7 text-[11.5px]">
        {error ? (
          <span className="text-red-600 dark:text-red-400">{error}</span>
        ) : saved ? (
          <span className="text-accent-600 dark:text-accent-400">Tersimpan di Todo</span>
        ) : (
          <>
            <span className="text-zinc-400">
              <span className="kbd">Enter</span> simpan <span className="kbd ml-1">Esc</span> tutup
            </span>
            {tags.length > 0 && <span className="text-zinc-500">Tag: {tags.join(", ")}</span>}
          </>
        )}
      </div>
    </div>
  );
}
