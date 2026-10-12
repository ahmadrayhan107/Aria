/** Max title length before splitting on the last space. Mirrors `parser.rs`. */
export const TITLE_MAX = 120;

/** Splits one line of text into title (first sentence) and body. Reversible with `joinTitle`. */
export function splitTitle(raw: string): { title: string; body: string } {
  const text = raw.trim();
  const chars = Array.from(text);
  let offset = 0;
  for (let i = 0; i < chars.length - 1; i++) {
    const a = chars[i]!;
    offset += a.length;
    if (i > 0 && (a === "." || a === "?" || a === "!") && chars[i + 1] === " ") {
      if (i + 1 > TITLE_MAX) break;
      return { title: text.slice(0, offset), body: text.slice(offset + 1) };
    }
  }
  if (chars.length <= TITLE_MAX) return { title: text, body: "" };
  const limit = chars.slice(0, TITLE_MAX).join("").length;
  const cut = text.slice(0, limit).lastIndexOf(" ");
  if (cut <= 0) return { title: text, body: "" };
  return { title: text.slice(0, cut), body: text.slice(cut + 1) };
}

export function joinTitle(title: string, body: string): string {
  const b = body.replace(/\r?\n/g, " ");
  return b ? `${title} ${b}` : title;
}
