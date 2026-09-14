import { describe, expect, it } from "vitest";
import { CAMPUS, CAMPUS_ROWS, makeWorld, roomOf, tileAt } from "./campus.ts";
import { findPath, indexOf, pointAt, walkableAt } from "./grid.ts";
import { nearestLandmark } from "./sight.ts";

describe("the campus", () => {
  it("is forty by twenty-four", () => {
    expect(CAMPUS_ROWS).toHaveLength(24);
    expect(CAMPUS_ROWS.every((row) => row.length === 40)).toBe(true);
    expect(CAMPUS.width).toBe(40);
    expect(CAMPUS.height).toBe(24);
  });

  it("has five buildings, each with one door onto walkable ground", () => {
    expect(CAMPUS.rooms.map((room) => room.name)).toEqual(["Library", "Gym", "Cafe", "Hall", "Lab"]);
    for (const room of CAMPUS.rooms) {
      expect(tileAt(CAMPUS, room.door)).toBe("door");
      expect(room.floor.length).toBeGreaterThan(10);
      const outside = [
        { x: room.door.x, y: room.door.y - 1 },
        { x: room.door.x, y: room.door.y + 1 },
      ].filter((tile) => roomOf(CAMPUS, tile) === null && walkableAt(CAMPUS, tile));
      expect(outside).toHaveLength(1);
    }
  });

  it("puts doors and floors in their room and everything else outdoors", () => {
    const library = CAMPUS.rooms[0];
    expect(library).toBeDefined();
    expect(roomOf(CAMPUS, library?.door ?? { x: 0, y: 0 })).toBe(0);
    expect(roomOf(CAMPUS, { x: 3, y: 2 })).toBe(0);
    expect(roomOf(CAMPUS, { x: 19, y: 9 })).toBeNull();
    expect(CAMPUS.open.every((tile) => roomOf(CAMPUS, tile) === null)).toBe(true);
  });

  it("starts everyone outdoors on walkable ground", () => {
    expect(CAMPUS.spawns).toHaveLength(8);
    for (const spawn of CAMPUS.spawns) {
      expect(walkableAt(CAMPUS, spawn)).toBe(true);
      expect(roomOf(CAMPUS, spawn)).toBeNull();
    }
  });

  it("can be walked end to end: no tile is cut off", () => {
    const start = CAMPUS.spawns[0] ?? { x: 0, y: 0 };
    const cutOff = CAMPUS.walkable
      .map((walkable, index) => (walkable ? pointAt(CAMPUS, index) : null))
      .filter((tile) => tile !== null && findPath(CAMPUS, start, tile) === null);
    expect(cutOff).toEqual([]);
  });

  it("names the nearest landmark", () => {
    expect(nearestLandmark(CAMPUS, { x: 18, y: 10 }).name).toBe("the fountain");
    expect(nearestLandmark(CAMPUS, { x: 5, y: 7 }).name).toBe("the Library");
  });

  it("refuses a map with an unknown symbol, a ragged row or a spawn in a wall", () => {
    const plan = { rooms: [], landmarks: [], spawns: [{ x: 0, y: 0 }] };
    expect(() => makeWorld({ ...plan, rows: ["..", "x."] })).toThrow(/unknown tile/);
    expect(() => makeWorld({ ...plan, rows: ["...", ".."] })).toThrow(/same width/);
    expect(() => makeWorld({ ...plan, rows: ["W.", ".."] })).toThrow(/not walkable/);
    expect(() => makeWorld({ ...plan, rows: ["__", ".."], rooms: [{ name: "Shed", at: { x: 0, y: 0 } }] })).toThrow(/no door/);
  });

  it("indexes tiles row by row", () => {
    expect(indexOf(CAMPUS, { x: 3, y: 2 })).toBe(83);
    expect(pointAt(CAMPUS, 83)).toEqual({ x: 3, y: 2 });
  });
});
