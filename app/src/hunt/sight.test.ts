import { describe, expect, it } from "vitest";
import { CAMPUS } from "./campus.ts";
import { SIGHT, canSee } from "./sight.ts";

const LIBRARY_FLOOR = { x: 4, y: 3 };
const LIBRARY_DOOR = { x: 6, y: 6 };
const OUTSIDE_LIBRARY = { x: 6, y: 7 };

describe("sight", () => {
  it("reaches nine tiles outdoors and no further", () => {
    expect(canSee(CAMPUS, { x: 10, y: 8 }, { x: 10 + SIGHT, y: 8 })).toBe(true);
    expect(canSee(CAMPUS, { x: 10, y: 8 }, { x: 11 + SIGHT, y: 8 })).toBe(false);
  });

  it("sees everyone in the same room and nobody outside it", () => {
    expect(canSee(CAMPUS, LIBRARY_FLOOR, { x: 8, y: 5 })).toBe(true);
    expect(canSee(CAMPUS, LIBRARY_FLOOR, OUTSIDE_LIBRARY)).toBe(false);
    expect(canSee(CAMPUS, OUTSIDE_LIBRARY, LIBRARY_FLOOR)).toBe(false);
  });

  it("counts a doorway as inside", () => {
    expect(canSee(CAMPUS, LIBRARY_FLOOR, LIBRARY_DOOR)).toBe(true);
    expect(canSee(CAMPUS, OUTSIDE_LIBRARY, LIBRARY_DOOR)).toBe(false);
  });
});
