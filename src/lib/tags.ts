/** Keyword rules for automatic project tags. Mirrors `TAG_RULES` in `parser.rs`. */
export const TAG_RULES: [tag: string, keywords: string[]][] = [
  ["approval", ["approval"]],
  ["erp", ["erp", "payroll", "invoice", "gudang"]],
  ["recruitment", ["recruitment", "pelamar", "lamaran"]],
  ["web", ["website", "landing", "karir", "seo"]],
  ["infra", ["nas", "synology", "cloudflare", "dns", "email server", "tunnel", "web-station"]],
  ["riset", ["research", "riset", "jetson", "standar"]],
  ["tim", ["tim", "team", "talent"]],
];

const NON_WORD = /[^\p{L}\p{N}]+/u;

export function autoTags(text: string): string[] {
  const lower = text.toLowerCase();
  const tokens = new Set(lower.split(NON_WORD).filter(Boolean));
  return TAG_RULES.filter(([, kws]) =>
    kws.some((kw) => (NON_WORD.test(kw) ? lower.includes(kw) : tokens.has(kw))),
  ).map(([tag]) => tag);
}

export function normalizeTag(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}
