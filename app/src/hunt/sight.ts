// What one person on the campus can see of another. The same rule for you and for the bots.
// SPDX-License-Identifier: Apache-2.0

import { type Landmark, type World, roomOf } from "./campus.ts";
import { type Point, chebyshev, manhattan } from "./grid.ts";

/** How far you can make somebody out in the dark, in tiles. */
export const SIGHT = 9;

/**
 * Indoors you see everyone in the same room and nobody else. Outdoors you see anyone within
 * range who is also outdoors. Somebody standing in a doorway has gone in.
 */
export const canSee = (world: World, from: Point, to: Point): boolean => {
  const here = roomOf(world, from);
  const there = roomOf(world, to);
  if (here !== null || there !== null) {
    return here === there;
  }
  return chebyshev(from, to) <= SIGHT;
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
