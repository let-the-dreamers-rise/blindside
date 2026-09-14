// One campus at night, drawn as text so it can be read, changed and tested without a picture.
// SPDX-License-Identifier: Apache-2.0

import {
  DIRS,
  type Grid,
  type Point,
  indexOf,
  inside,
  keyOf,
  moved,
  pointAt,
} from "./grid.ts";

export type Tile = "grass" | "path" | "tree" | "wall" | "floor" | "door" | "water" | "bench";

const LEGEND: Readonly<Record<string, Tile>> = {
  ".": "grass",
  ",": "path",
  T: "tree",
  W: "wall",
  _: "floor",
  D: "door",
  "~": "water",
  "=": "bench",
};

const WALKABLE: ReadonlySet<Tile> = new Set<Tile>(["grass", "path", "floor", "door"]);

export type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

/** A building you can walk into. Its floor is hidden under a roof unless you are inside. */
export type Room = {
  readonly name: string;
  readonly door: Point;
  readonly floor: readonly Point[];
  readonly bounds: Rect;
};

export type Landmark = { readonly name: string; readonly at: Point };

export type World = Grid & {
  readonly tiles: readonly Tile[];
  readonly rooms: readonly Room[];
  /** Which room each tile belongs to, doors included. Null outdoors. */
  readonly roomIndex: readonly (number | null)[];
  readonly landmarks: readonly Landmark[];
  readonly spawns: readonly Point[];
  /** Every walkable tile that is not inside a building. */
  readonly open: readonly Point[];
};

export type Blueprint = {
  readonly rows: readonly string[];
  readonly rooms: readonly { readonly name: string; readonly at: Point }[];
  readonly landmarks: readonly Landmark[];
  readonly spawns: readonly Point[];
};

const parseTiles = (rows: readonly string[]): readonly Tile[] =>
  rows.flatMap((row, y) =>
    [...row].map((char, x) => {
      const tile = LEGEND[char];
      if (tile === undefined) {
        throw new Error(`unknown tile "${char}" at ${x},${y}`);
      }
      return tile;
    }),
  );

const flood = (grid: Grid, tiles: readonly Tile[], start: Point): readonly Point[] => {
  if (tiles[indexOf(grid, start)] !== "floor") {
    throw new Error(`no floor at ${keyOf(start)}`);
  }
  const seen = new Set<string>([keyOf(start)]);
  const queue: Point[] = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const here = queue[head];
    if (here === undefined) {
      break;
    }
    for (const dir of DIRS) {
      const next = moved(here, dir);
      const key = keyOf(next);
      if (!inside(grid, next) || seen.has(key) || tiles[indexOf(grid, next)] !== "floor") {
        continue;
      }
      seen.add(key);
      queue.push(next);
    }
  }
  return queue;
};

const doorOf = (grid: Grid, tiles: readonly Tile[], floor: readonly Point[]): Point => {
  const door = floor
    .flatMap((tile) => DIRS.map((dir) => moved(tile, dir)))
    .find((next) => inside(grid, next) && tiles[indexOf(grid, next)] === "door");
  if (door === undefined) {
    throw new Error("a room with no door");
  }
  return door;
};

const boundsOf = (floor: readonly Point[]): Rect => {
  const xs = floor.map((tile) => tile.x);
  const ys = floor.map((tile) => tile.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1 };
};

export const makeWorld = (plan: Blueprint): World => {
  const width = plan.rows[0]?.length ?? 0;
  if (plan.rows.some((row) => row.length !== width)) {
    throw new Error("every row of the map must be the same width");
  }
  const tiles = parseTiles(plan.rows);
  const grid: Grid = {
    width,
    height: plan.rows.length,
    walkable: tiles.map((tile) => WALKABLE.has(tile)),
  };
  const rooms: readonly Room[] = plan.rooms.map((room) => {
    const floor = flood(grid, tiles, room.at);
    return { name: room.name, floor, door: doorOf(grid, tiles, floor), bounds: boundsOf(floor) };
  });
  const owner = new Map<string, number>(
    rooms.flatMap((room, index) => [...room.floor, room.door].map((tile) => [keyOf(tile), index])),
  );
  const roomIndex = tiles.map((_, index) => owner.get(keyOf(pointAt(grid, index))) ?? null);
  const open = tiles
    .map((_, index) => pointAt(grid, index))
    .filter((tile) => (grid.walkable[indexOf(grid, tile)] ?? false) && roomIndex[indexOf(grid, tile)] === null);
  const spawnsOk = plan.spawns.every((tile) => grid.walkable[indexOf(grid, tile)] ?? false);
  if (!spawnsOk) {
    throw new Error("a spawn point is not walkable");
  }
  return {
    ...grid,
    tiles,
    rooms,
    roomIndex,
    open,
    spawns: plan.spawns,
    landmarks: [...rooms.map((room) => ({ name: `the ${room.name}`, at: room.door })), ...plan.landmarks],
  };
};

export const tileAt = (world: World, point: Point): Tile | null =>
  inside(world, point) ? (world.tiles[indexOf(world, point)] ?? null) : null;

export const roomOf = (world: World, point: Point): number | null =>
  inside(world, point) ? (world.roomIndex[indexOf(world, point)] ?? null) : null;

// Forty by twenty-four. Two main paths cross at the fountain; five buildings, each with one door.
//   .  grass   ,  path   T  tree   W  wall   _  floor   D  door   ~  water   =  bench
export const CAMPUS_ROWS: readonly string[] = [
  "T.........T.......,,.......T..........T.",
  "..WWWWWWWW........,,........WWWWWWWWW...",
  "..W______W........,,........W_______W...",
  "..W______W...T....,,....T...W_______W...",
  "..W______W........,,........W_______W...",
  "..W______W........,,........W_______W...",
  "..WWWWDWWW........,,........WWWWDWWWW...",
  "......,...........,,............,......T",
  "T.....,,,,,,,,,,,,,,,,,,,,,,,,,,,,......",
  "......,...........,,............,....T..",
  "..T...,.........,,,,,,..........,.......",
  ",,,,,,,,,,,,,,,,,~~~~,,,,,,,,,,,,,,,,,,,",
  ",,,,,,,,,,,,,,,,,~~~~,,,,,,,,,,,,,,,,,,,",
  "......,.........,,,,,,..........,.....T.",
  "..T...,...=.......,,........=...,.......",
  "......,...........,,............,.WWWWWW",
  "..WWWWDWW.........,,............,.W____W",
  "..W_____W.........,,....WWWWWWDWW.W____W",
  "..W_____W..T......,,....W_______W.W____W",
  "..W_____W.........,,....W_______W.W____W",
  "..W_____W...T.....,,....W_______W.W____W",
  "..WWWWWWW.........,,....WWWWWWWWW.WWWDWW",
  "...........T......,,.........T......,,..",
  "T.T......T........,,..........T....T..T.",
];

export const CAMPUS: World = makeWorld({
  rows: CAMPUS_ROWS,
  rooms: [
    { name: "Library", at: { x: 3, y: 2 } },
    { name: "Gym", at: { x: 29, y: 2 } },
    { name: "Cafe", at: { x: 3, y: 17 } },
    { name: "Hall", at: { x: 25, y: 18 } },
    { name: "Lab", at: { x: 35, y: 16 } },
  ],
  landmarks: [
    { name: "the fountain", at: { x: 19, y: 11 } },
    { name: "the north path", at: { x: 19, y: 3 } },
    { name: "the south path", at: { x: 19, y: 21 } },
    { name: "the west benches", at: { x: 10, y: 14 } },
    { name: "the east benches", at: { x: 28, y: 14 } },
  ],
  // You are always the first. The rest are spread so that a small game is not eight people in
  // one corner and a large one still starts nobody next to anybody.
  spawns: [
    { x: 19, y: 9 },
    { x: 5, y: 8 },
    { x: 34, y: 8 },
    { x: 12, y: 13 },
    { x: 27, y: 13 },
    { x: 6, y: 14 },
    { x: 33, y: 14 },
    { x: 19, y: 22 },
    { x: 19, y: 3 },
    { x: 10, y: 8 },
    { x: 26, y: 8 },
    { x: 33, y: 21 },
  ],
});
