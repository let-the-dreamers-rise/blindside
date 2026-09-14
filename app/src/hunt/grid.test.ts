import { describe, expect, it } from "vitest";
import {
  type Grid,
  adjacent,
  chebyshev,
  findPath,
  findPathToAdjacent,
  keyOf,
  moved,
  neighbours,
  walkableAt,
} from "./grid.ts";

// A five by three room with a wall down the middle and a gap at the bottom:
//   . . W . .
//   . . W . .
//   . . . . .
const ROOM: Grid = {
  width: 5,
  height: 3,
  walkable: [true, true, false, true, true, true, true, false, true, true, true, true, true, true, true],
};

describe("points", () => {
  it("moves one tile in a direction", () => {
    expect(moved({ x: 1, y: 1 }, "up")).toEqual({ x: 1, y: 0 });
    expect(moved({ x: 1, y: 1 }, "right")).toEqual({ x: 2, y: 1 });
  });

  it("counts diagonals as adjacent and a tile as not adjacent to itself", () => {
    expect(adjacent({ x: 1, y: 1 }, { x: 2, y: 2 })).toBe(true);
    expect(adjacent({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(false);
    expect(chebyshev({ x: 0, y: 0 }, { x: 3, y: -5 })).toBe(5);
    expect(keyOf({ x: 3, y: 4 })).toBe("3,4");
  });
});

describe("walking", () => {
  it("knows the edges and the walls", () => {
    expect(walkableAt(ROOM, { x: -1, y: 0 })).toBe(false);
    expect(walkableAt(ROOM, { x: 2, y: 0 })).toBe(false);
    expect(walkableAt(ROOM, { x: 2, y: 2 })).toBe(true);
    expect(neighbours(ROOM, { x: 0, y: 0 })).toEqual([{ x: 0, y: 1 }, { x: 1, y: 0 }]);
  });

  it("finds the way round a wall", () => {
    const path = findPath(ROOM, { x: 1, y: 0 }, { x: 3, y: 0 });
    expect(path).not.toBeNull();
    expect(path?.at(-1)).toEqual({ x: 3, y: 0 });
    expect(path).toHaveLength(6);
    expect(path?.some((step) => step.x === 2 && step.y === 2)).toBe(true);
  });

  it("stops next to somebody rather than on top of them", () => {
    const path = findPathToAdjacent(ROOM, { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(path?.at(-1)).toEqual({ x: 3, y: 1 });
    expect(findPathToAdjacent(ROOM, { x: 3, y: 1 }, { x: 4, y: 0 })).toEqual([]);
  });

  it("treats somebody in a doorway as a wall for this walk only", () => {
    const blocked = new Set([keyOf({ x: 2, y: 2 })]);
    expect(findPath(ROOM, { x: 0, y: 0 }, { x: 4, y: 0 }, blocked)).toBeNull();
    expect(findPath(ROOM, { x: 0, y: 0 }, { x: 4, y: 0 })).not.toBeNull();
  });
});
