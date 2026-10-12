import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { joinTitle, splitTitle, TITLE_MAX } from "./title";
import { autoTags, normalizeTag } from "./tags";
import { toPrompt } from "./prompt";
import { dueState, groupKey, weekStart, isoDay } from "./dates";

const fixture = readFileSync(join(import.meta.dir, "../../src-tauri/tests/fixtures/Notes.txt"), "utf8");
const items = fixture
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l.startsWith("- "))
  .map((l) => l.slice(2).trim());

describe("splitTitle", () => {
  test("takes the first sentence", () => {
    expect(splitTitle("Mode worker tidak jalan. Mode klasik di bawah target.")).toEqual({
      title: "Mode worker tidak jalan.",
      body: "Mode klasik di bawah target.",
    });
  });

  test("ignores dots inside domains", () => {
    expect(splitTitle("cek erp.example.com sekarang").body).toBe("");
  });

  test("cuts long text at a space", () => {
    const long = "kata ".repeat(60).trim();
    const { title, body } = splitTitle(long);
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(body.length).toBeGreaterThan(0);
    expect(joinTitle(title, body)).toBe(long);
  });

  test("is reversible for every line in Notes.txt", () => {
    expect(items.length).toBe(88);
    for (const it of items) {
      const { title, body } = splitTitle(it);
      expect(joinTitle(title, body)).toBe(it);
    }
  });

  test("joinTitle flattens newlines", () => {
    expect(joinTitle("A.", "b\nc")).toBe("A. b c");
    expect(joinTitle("A.", "")).toBe("A.");
  });
});

describe("autoTags", () => {
  test("matches PRD keyword rules", () => {
    expect(autoTags("setting email server synology dan config tunnel cloudflare")).toEqual(["infra"]);
    expect(autoTags("perbarui halaman karir di website")).toEqual(["web"]);
    expect(autoTags("buat tim untuk go to CTO, hunting talent")).toEqual(["tim"]);
    expect(autoTags("Research AI untuk erp.example.com jetson")).toEqual(["erp", "riset"]);
    expect(autoTags("check Kembali urutan pelamar")).toEqual(["recruitment"]);
  });

  test("matches whole words only", () => {
    expect(autoTags("timeline proyek")).toEqual([]);
    expect(autoTags("analisa canasta")).toEqual([]);
  });

  test("tags most of the real file", () => {
    const tagged = items.filter((i) => autoTags(i).length > 0).length;
    expect(tagged).toBeGreaterThan(10);
  });

  test("normalizeTag", () => {
    expect(normalizeTag("  Data Center ")).toBe("data-center");
  });
});

describe("toPrompt", () => {
  test("renders markdown", () => {
    const md = toPrompt({
      title: "Deploy recruitment",
      body: "via web-station",
      checklist: [
        { text: "build", done: true },
        { text: "uji", done: false },
      ],
      tags: ["recruitment", "infra"],
      dueAt: "2026-10-28",
    });
    expect(md).toBe(
      "# Deploy recruitment\n\nvia web-station\n\n- [x] build\n- [ ] uji\n\nProyek: recruitment, infra\nTenggat: 2026-10-28\n",
    );
  });

  test("skips empty parts", () => {
    expect(toPrompt({ title: "A", body: " ", checklist: [], tags: [], dueAt: null })).toBe("# A\n");
  });
});

describe("dates", () => {
  const today = new Date(2026, 9, 12);
  test("dueState", () => {
    expect(dueState("2026-10-11", today)).toBe("overdue");
    expect(dueState("2026-10-12", today)).toBe("today");
    expect(dueState("2026-10-13", today)).toBe("soon");
    expect(dueState("2026-10-20", today)).toBe("later");
  });

  test("weekStart is Monday", () => {
    expect(isoDay(weekStart(new Date(2026, 9, 18)))).toBe("2026-10-12");
    expect(isoDay(weekStart(new Date(2026, 9, 12)))).toBe("2026-10-12");
  });

  test("groupKey", () => {
    expect(groupKey("2026-10-14T09:00:00", "week")).toEqual({ key: "2026-10-12", label: "12–18 Okt 2026" });
    expect(groupKey("2026-09-30", "week").label).toBe("28 Sep – 4 Okt 2026");
    expect(groupKey("2026-10-14", "month")).toEqual({ key: "2026-10", label: "Oktober 2026" });
  });
});
