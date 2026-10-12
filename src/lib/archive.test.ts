import { describe, expect, test } from "bun:test";
import { groupDone } from "./archive";
import type { Note } from "./types";

let seq = 0;
function note(doneAt: string | null, position = 0): Note {
  return {
    id: ++seq,
    title: `n${seq}`,
    body: "",
    status: "done",
    position,
    needsReview: false,
    reviewReason: null,
    createdAt: "2026-10-01T00:00:00",
    updatedAt: "2026-10-01T00:00:00",
    doneAt,
    dueAt: null,
    sourceLine: null,
    tags: [],
    checklist: [],
  };
}

describe("groupDone", () => {
  const notes = [
    note("2026-10-12T09:00:00"),
    note("2026-10-14T09:00:00"),
    note("2026-09-30T09:00:00"),
    note(null, 1),
    note(null, 0),
  ];

  test("groups by week, newest first, undated last", () => {
    const g = groupDone(notes, "week");
    expect(g.map((x) => x.key)).toEqual(["2026-10-12", "2026-09-28", "~"]);
    expect(g[0]!.notes.map((n) => n.doneAt)).toEqual(["2026-10-14T09:00:00", "2026-10-12T09:00:00"]);
    expect(g[2]!.notes.map((n) => n.position)).toEqual([0, 1]);
  });

  test("groups by month", () => {
    const g = groupDone(notes, "month");
    expect(g.map((x) => x.label)).toEqual(["Oktober 2026", "September 2026", "Tanpa tanggal selesai (hasil impor)"]);
  });

  test("empty input", () => {
    expect(groupDone([], "week")).toEqual([]);
  });
});
