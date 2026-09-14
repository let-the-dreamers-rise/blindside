import { describe, expect, it } from "vitest";
import { CAMPUS, CAMPUS_ROWS, makeWorld, roomOf, tileAt } from "./campus.ts";
import { findPath, indexOf, pointAt, walkableAt } from "./grid.ts";
import { PLACES } from "./places.ts";
import { nearestLandmark } from "./sight.ts";

// Everything in here is true of any place a hunt can happen, so a new map is checked the day it
// is added rather than the day somebody notices a courtyard nobody can walk into.
describe.each(PLACES)("$name", ({ world }) => {
  it("is forty by twenty-four", () => {
    expect(world.width).toBe(40);
    expect(world.height).toBe(24);
  });

  it("has buildings, each with one door onto walkable ground", () => {
    expect(world.rooms.length).toBeGreaterThan(0);
    for (const room of world.rooms) {
      expect(tileAt(world, room.door)).toBe("door");
      expect(room.floor.length).toBeGreaterThan(10);
      const outside = [
        { x: room.door.x, y: room.door.y - 1 },
        { x: room.door.x, y: room.door.y + 1 },
      ].filter((tile) => roomOf(world, tile) === null && walkableAt(world, tile));
      expect(outside).toHaveLength(1);
    }
  });

  it("starts everyone outdoors on walkable ground, with room for the largest game", () => {
    expect(world.spawns.length).toBeGreaterThanOrEqual(12);
    for (const spawn of world.spawns) {
      expect(walkableAt(world, spawn)).toBe(true);
      expect(roomOf(world, spawn)).toBeNull();
    }
  });

  it("never starts two people on the same tile", () => {
    const tiles = world.spawns.map((spawn) => `${spawn.x},${spawn.y}`);
    expect(new Set(tiles).size).toBe(tiles.length);
  });

  it("can be walked end to end: no tile is cut off", () => {
    const start = world.spawns[0] ?? { x: 0, y: 0 };
    const cutOff = world.walkable
      .map((walkable, index) => (walkable ? pointAt(world, index) : null))
      .filter((tile) => tile !== null && findPath(world, start, tile) === null);
    expect(cutOff).toEqual([]);
  });

  it("keeps its outdoor tiles out of every room", () => {
    expect(world.open.every((tile) => roomOf(world, tile) === null)).toBe(true);
  });

  it("names a landmark for anywhere on it", () => {
    expect(world.landmarks.length).toBeGreaterThan(2);
    expect(nearestLandmark(world, world.spawns[0] ?? { x: 0, y: 0 }).name).toBeTruthy();
  });
});

describe("the campus", () => {
  it("is a block of text forty characters wide", () => {
    expect(CAMPUS_ROWS).toHaveLength(24);
    expect(CAMPUS_ROWS.every((row) => row.length === 40)).toBe(true);
  });

  it("has five buildings", () => {
    expect(CAMPUS.rooms.map((room) => room.name)).toEqual(["Library", "Gym", "Cafe", "Hall", "Lab"]);
  });

  it("puts doors and floors in their room and everything else outdoors", () => {
    const library = CAMPUS.rooms[0];
    expect(library).toBeDefined();
    expect(roomOf(CAMPUS, library?.door ?? { x: 0, y: 0 })).toBe(0);
    expect(roomOf(CAMPUS, { x: 3, y: 2 })).toBe(0);
    expect(roomOf(CAMPUS, { x: 19, y: 9 })).toBeNull();
    expect(CAMPUS.open.every((tile) => roomOf(CAMPUS, tile) === null)).toBe(true);
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
