import { describe, expect, test } from "bun:test";
import { fullIndex } from "./reorder";

describe("fullIndex", () => {
  test("unfiltered column: index equals visible index", () => {
    // full column without card 9: [1,2,3]; card 9 dropped between 1 and 2.
    expect(fullIndex([1, 9, 2, 3], 9, [1, 2, 3])).toBe(1);
    expect(fullIndex([9, 1, 2, 3], 9, [1, 2, 3])).toBe(0);
    expect(fullIndex([1, 2, 3, 9], 9, [1, 2, 3])).toBe(3);
  });

  test("filtered column maps around hidden cards", () => {
    // full: [1,2,3,4,5]; visible (filtered): [2,9,5] -> before 5 in full.
    expect(fullIndex([2, 9, 5], 9, [1, 2, 3, 4, 5])).toBe(4);
    // last visible after 2 -> right after 2.
    expect(fullIndex([2, 9], 9, [1, 2, 3, 4, 5])).toBe(2);
  });

  test("empty visible column", () => {
    expect(fullIndex([9], 9, [1, 2])).toBe(2);
    expect(fullIndex([9], 9, [1, 2], true)).toBe(0);
  });

  test("unknown neighbour falls back to end", () => {
    expect(fullIndex([7, 9], 9, [1, 2])).toBe(2);
  });
});
