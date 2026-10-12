const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** Parses `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SS` as a local date (time dropped). */
export function parseDay(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function shortDate(s: string): string {
  const d = parseDay(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fullDate(s: string): string {
  const d = parseDay(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Monday of the week containing `d`. */
export function weekStart(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
}

export type Grouping = "week" | "month";

export function groupKey(s: string, by: Grouping): { key: string; label: string } {
  const d = parseDay(s);
  if (by === "month") {
    return { key: isoDay(d).slice(0, 7), label: `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}` };
  }
  const start = weekStart(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const label =
    start.getMonth() === end.getMonth()
      ? `${start.getDate()}–${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
      : `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
  return { key: isoDay(start), label };
}

export type DueState = "overdue" | "today" | "soon" | "later";

export function dueState(due: string, today: Date = new Date()): DueState {
  const diff = Math.round((parseDay(due).getTime() - parseDay(isoDay(today)).getTime()) / 86_400_000);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 2) return "soon";
  return "later";
}
