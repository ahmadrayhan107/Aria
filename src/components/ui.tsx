import { useEffect, type ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import { useNotes } from "../store/notes";

export function TagDot({ name, color }: { name: string; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11.5px] text-zinc-500 dark:text-zinc-400">
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: color ?? "#71717a" }} />
      {name}
    </span>
  );
}

export function useTagColor(): (name: string) => string | undefined {
  const tags = useNotes((s) => s.tags);
  return (name) => tags.find((t) => t.name === name)?.color;
}

export function ReviewBadge({ title }: { title?: string | null }) {
  return (
    <span
      title={title ?? undefined}
      className="inline-flex h-[18px] items-center rounded border border-amber-300/70 bg-amber-50 px-1.5 text-[10.5px] font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
    >
      Perlu review
    </span>
  );
}

/** Centered overlay dialog for import/export. Closes on Escape and backdrop click. */
export function Dialog({
  title,
  onClose,
  children,
  width = "max-w-[560px]",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-zinc-950/30 pt-[12vh] dark:bg-black/50" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={`w-full ${width} overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_24px_48px_-24px_rgba(24,24,27,0.35)] dark:border-zinc-800 dark:bg-zinc-900`}
      >
        <div className="flex h-11 items-center justify-between border-b border-zinc-100 px-4 dark:border-zinc-800">
          <h2 className="text-[13.5px] font-semibold tracking-tight">{title}</h2>
          <button className="btn-ghost h-6 px-1" onClick={onClose} aria-label="Tutup">
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast() {
  const toast = useNotes((s) => s.toast);
  if (!toast) return null;
  return (
    <div
      key={toast.id}
      role="status"
      className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md px-3 py-2 text-[12.5px] font-medium shadow-lg animate-[toast_.18s_ease-out] ${
        toast.tone === "error" ? "bg-red-600 text-white" : "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
      }`}
    >
      {toast.text}
    </div>
  );
}
