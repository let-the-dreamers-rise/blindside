import { describe, expect, it } from "vitest";
import { CAMPUS, tileAt } from "./campus.ts";
import { pointAt } from "./grid.ts";
import { SIGHT, canSee, clearLine } from "./sight.ts";

const LIBRARY_FLOOR = { x: 4, y: 3 };
const LIBRARY_DOOR = { x: 6, y: 6 };
const OUTSIDE_LIBRARY = { x: 6, y: 7 };
/** West of the Library and east of it, nine tiles apart, with the whole building in between. */
const WEST_OF_LIBRARY = { x: 1, y: 3 };
const EAST_OF_LIBRARY = { x: 10, y: 3 };

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

  it("does not see through a building", () => {
    expect(canSee(CAMPUS, WEST_OF_LIBRARY, EAST_OF_LIBRARY)).toBe(false);
    // The same nine tiles along an open path, to show it is the building and not the distance.
    expect(canSee(CAMPUS, { x: 10, y: 8 }, { x: 19, y: 8 })).toBe(true);
  });

  it("does not see through a tree", () => {
    expect(tileAt(CAMPUS, { x: 10, y: 0 })).toBe("tree");
    expect(canSee(CAMPUS, { x: 9, y: 0 }, { x: 11, y: 0 })).toBe(false);
  });

  it("never hides somebody you are standing next to", () => {
    expect(clearLine(CAMPUS, { x: 9, y: 0 }, { x: 10, y: 0 })).toBe(true);
    expect(clearLine(CAMPUS, { x: 1, y: 1 }, { x: 2, y: 2 })).toBe(true);
  });

  it("is the same rule in both directions", () => {
    const outdoors = CAMPUS.walkable
      .map((yes, index) => (yes ? pointAt(CAMPUS, index) : null))
      .filter((tile) => tile !== null)
      .filter((_, index) => index % 37 === 0);
    const asymmetric = outdoors.flatMap((from) =>
      outdoors.filter((to) => canSee(CAMPUS, from, to) !== canSee(CAMPUS, to, from)),
    );
    expect(asymmetric).toEqual([]);
  });
});
