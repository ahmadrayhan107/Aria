import { getCurrentWindow } from "@tauri-apps/api/window";
import { CornersOut, MagnifyingGlass, Minus, Monitor, Moon, Sun, X } from "@phosphor-icons/react";
import { useNotes } from "../store/notes";
import { nextTheme, setTheme, THEME_LABEL, useTheme, type Theme } from "../lib/theme";

const win = () => getCurrentWindow();

const THEME_ICON: Record<Theme, React.ReactNode> = {
  system: <Monitor size={14} />,
  light: <Sun size={14} />,
  dark: <Moon size={14} />,
};

/** Cycles system, light, dark. */
function ThemeButton() {
  const theme = useTheme();
  const next = nextTheme(theme);
  const label = `Tema: ${THEME_LABEL[theme]}. Klik untuk ganti ke ${THEME_LABEL[next].toLowerCase()}`;
  return (
    <button
      aria-label={label}
      title={label}
      className="grid w-11 place-items-center text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      onClick={() => setTheme(next)}
    >
      {THEME_ICON[theme]}
    </button>
  );
}

export function Titlebar() {
  const setPalette = useNotes((s) => s.setPalette);
  return (
    <header
      data-tauri-drag-region
      className="grid h-9 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-zinc-200 bg-zinc-100/80 dark:border-zinc-800/80 dark:bg-zinc-950"
    >
      <div data-tauri-drag-region className="flex items-center gap-2 pl-3.5">
        <span className="size-2 rounded-[3px] bg-accent-500" />
        <span data-tauri-drag-region className="text-[12.5px] font-semibold tracking-tight">
          Aria
        </span>
      </div>
      <button
        onClick={() => setPalette(true)}
        className="flex h-6 w-[340px] items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 text-[12px] text-zinc-400 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
      >
        <MagnifyingGlass size={13} />
        <span className="flex-1 text-left">Cari catatan atau perintah</span>
        <span className="kbd">Ctrl K</span>
      </button>
      <div className="flex h-full justify-end">
        <ThemeButton />
        <span className="my-2.5 w-px bg-zinc-200 dark:bg-zinc-800" />
        <button aria-label="Minimalkan" className="grid w-11 place-items-center text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800" onClick={() => win().minimize()}>
          <Minus size={14} />
        </button>
        <button aria-label="Perbesar" className="grid w-11 place-items-center text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800" onClick={() => win().toggleMaximize()}>
          <CornersOut size={13} />
        </button>
        <button aria-label="Tutup ke tray" className="grid w-11 place-items-center text-zinc-500 hover:bg-red-600 hover:text-white" onClick={() => win().close()}>
          <X size={14} />
        </button>
      </div>
    </header>
  );
}
