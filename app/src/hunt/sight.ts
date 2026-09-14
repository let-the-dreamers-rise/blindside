// What one person on the campus can see of another. The same rule for you and for the bots.
// SPDX-License-Identifier: Apache-2.0

import { type Tile, type Landmark, type World, roomOf, tileAt } from "./campus.ts";
import { type Point, chebyshev, manhattan } from "./grid.ts";

/** How far you can make somebody out in the dark, in tiles. */
export const SIGHT = 9;

/** What you cannot see past. A building is obvious; a tree on the lawn is the other half of it. */
const OPAQUE: ReadonlySet<Tile> = new Set<Tile>(["wall", "tree"]);

const opaque = (world: World, at: Point): boolean => {
  const tile = tileAt(world, at);
  return tile !== null && OPAQUE.has(tile);
};

/**
 * Whether nothing stands between two tiles. The tiles themselves are not counted: somebody
 * standing against a wall is still somebody you can see.
 */
export const clearLine = (world: World, from: Point, to: Point): boolean => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  return Array.from({ length: Math.max(0, steps - 1) }).every((_, index) => {
    const along = (index + 1) / steps;
    return !opaque(world, {
      x: Math.round(from.x + dx * along),
      y: Math.round(from.y + dy * along),
    });
  });
};

/**
 * Indoors you see everyone in the same room and nobody else. Outdoors you see anyone within
 * range who is also outdoors and not behind something. Somebody standing in a doorway has gone in.
 */
export const canSee = (world: World, from: Point, to: Point): boolean => {
  const here = roomOf(world, from);
  const there = roomOf(world, to);
  if (here !== null || there !== null) {
    return here === there;
  }
  return chebyshev(from, to) <= SIGHT && clearLine(world, from, to);
};

export const nearestLandmark = (world: World, point: Point): Landmark => {
  const [first, ...rest] = world.landmarks;
  if (first === undefined) {
    return { name: "somewhere", at: point };
  }
  return rest.reduce(
    (best, candidate) => (manhattan(candidate.at, point) < manhattan(best.at, point) ? candidate : best),
    first,
  );
};
