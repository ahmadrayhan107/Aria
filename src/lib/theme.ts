import { useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark";

export const THEMES: Theme[] = ["system", "light", "dark"];
export const THEME_LABEL: Record<Theme, string> = { system: "Ikuti sistem", light: "Terang", dark: "Gelap" };

const KEY = "aria.theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

let current: Theme = "system";

export function resolveTheme(theme: Theme, systemDark: boolean): "light" | "dark" {
  return theme === "system" ? (systemDark ? "dark" : "light") : theme;
}

function apply() {
  const mode = resolveTheme(current, media().matches);
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
  listeners.forEach((l) => l());
}

/** Call once per window before the first render to avoid a flash of the wrong theme. */
export function initTheme() {
  current = read();
  apply();
  media().addEventListener("change", apply);
  // The quick-capture window shares localStorage; follow changes made in the other window.
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    current = read();
    apply();
  });
}

export function setTheme(theme: Theme) {
  current = theme;
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Storage blocked: the choice still applies for this session.
  }
  apply();
}

export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]!;
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
