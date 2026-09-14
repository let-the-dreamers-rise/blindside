// The campus is a grid of tiles. Everything that walks on it walks with these.
// SPDX-License-Identifier: Apache-2.0

export type Point = { readonly x: number; readonly y: number };
export type Dir = "up" | "down" | "left" | "right";

export const DIRS: readonly Dir[] = ["up", "down", "left", "right"];

const DELTA: Readonly<Record<Dir, Point>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const moved = (from: Point, dir: Dir): Point => ({
  x: from.x + DELTA[dir].x,
  y: from.y + DELTA[dir].y,
});

export const same = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;
export const keyOf = (point: Point): string => `${point.x},${point.y}`;

export const chebyshev = (a: Point, b: Point): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export const manhattan = (a: Point, b: Point): number =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Touching, diagonals included. A tile is not adjacent to itself. */
export const adjacent = (a: Point, b: Point): boolean => chebyshev(a, b) === 1;

export type Grid = {
  readonly width: number;
  readonly height: number;
  readonly walkable: readonly boolean[];
};

export const inside = (grid: Grid, point: Point): boolean =>
  point.x >= 0 && point.y >= 0 && point.x < grid.width && point.y < grid.height;

export const indexOf = (grid: Grid, point: Point): number => point.y * grid.width + point.x;

export const pointAt = (grid: Grid, index: number): Point => ({
  x: index % grid.width,
  y: Math.floor(index / grid.width),
});

export const walkableAt = (grid: Grid, point: Point): boolean =>
  inside(grid, point) && (grid.walkable[indexOf(grid, point)] ?? false);

export const neighbours = (grid: Grid, point: Point): readonly Point[] =>
  DIRS.map((dir) => moved(point, dir)).filter((next) => walkableAt(grid, next));

type Goal = (point: Point) => boolean;

const trace = (
  parents: ReadonlyMap<string, Point>,
  from: Point,
  end: Point,
): readonly Point[] => {
  const steps: Point[] = [];
  for (let at: Point | undefined = end; at !== undefined && !same(at, from); at = parents.get(keyOf(at))) {
    steps.push(at);
  }
  return steps.reverse();
};

/**
 * Breadth first search over walkable tiles. Returns the steps after `from`, ending on the first
 * tile that satisfies the goal, or null when no such tile can be reached. Tiles in `blocked` are
 * treated as walls for this search only, which is how somebody standing in a doorway is handled.
 */
export const search = (
  grid: Grid,
  from: Point,
  goal: Goal,
  blocked: ReadonlySet<string> = new Set(),
): readonly Point[] | null => {
  if (goal(from)) {
    return [];
  }
  const parents = new Map<string, Point>();
  const seen = new Set<string>([keyOf(from)]);
  const queue: Point[] = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const here = queue[head];
    if (here === undefined) {
      break;
    }
    for (const next of neighbours(grid, here)) {
      const key = keyOf(next);
      if (seen.has(key) || blocked.has(key)) {
        continue;
      }
      seen.add(key);
      parents.set(key, here);
      if (goal(next)) {
        return trace(parents, from, next);
      }
      queue.push(next);
    }
  }
  return null;
};

export const findPath = (
  grid: Grid,
  from: Point,
  to: Point,
  blocked?: ReadonlySet<string>,
): readonly Point[] | null => search(grid, from, (point) => same(point, to), blocked);

/** A path that ends next to `to` rather than on it: how you walk up to somebody. */
export const findPathToAdjacent = (
  grid: Grid,
  from: Point,
  to: Point,
  blocked?: ReadonlySet<string>,
): readonly Point[] | null => search(grid, from, (point) => adjacent(point, to), blocked);
