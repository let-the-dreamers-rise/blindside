// The grounds close. For the first three quarters of a minute the campus is the whole campus.
// After that it empties from the edges: the strangers go home, the other players are drawn in,
// and anybody still outside is standing under a light. It is the only thing in the game that
// forces an ending, and it is the reason a hunt finishes in a confrontation rather than on the
// clock.
//
// Pure, and a function of the tick alone, so a replayed game closes at exactly the same moment.
// SPDX-License-Identifier: Apache-2.0

import type { Grid, Point } from "./grid.ts";

/** Ticks of whole campus before anything closes. Grace is over by then and the hunt is on. */
export const CLOSE_AT = 300;
/** Ticks the walk in takes, once it has begun. Three quarters of a five minute game. */
export const CLOSE_OVER = 900;
/** What is left at the end, as half-extents in tiles from the middle of the map. */
export const QUAD_X = 5;
export const QUAD_Y = 4;

export type Ring = {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
};

/** How far in the close has come: 0 before it starts, 1 once only the quad is left. */
export const closing = (tick: number): number =>
  tick <= CLOSE_AT ? 0 : Math.min(1, (tick - CLOSE_AT) / CLOSE_OVER);

/** The ground still open at this tick, or null while the whole campus is still open. */
export const ringAt = (grid: Grid, tick: number): Ring | null => {
  const part = closing(tick);
  if (part === 0) {
    return null;
  }
  const midX = (grid.width - 1) / 2;
  const midY = (grid.height - 1) / 2;
  const halfX = Math.max(QUAD_X, (midX + 1) * (1 - part));
  const halfY = Math.max(QUAD_Y, (midY + 1) * (1 - part));
  return {
    x0: Math.round(midX - halfX),
    y0: Math.round(midY - halfY),
    x1: Math.round(midX + halfX),
    y1: Math.round(midY + halfY),
  };
};

export const outsideRing = (ring: Ring | null, at: Point): boolean =>
  ring !== null && (at.x < ring.x0 || at.x > ring.x1 || at.y < ring.y0 || at.y > ring.y1);

/**
 * The tiles of a set that are still open. Somewhere to send a player who needs a destination.
 * A ring that leaves none of them gives them all back rather than stranding anybody.
 */
export const insideRing = <T extends Point>(ring: Ring | null, tiles: readonly T[]): readonly T[] => {
  if (ring === null) {
    return tiles;
  }
  const kept = tiles.filter((tile) => !outsideRing(ring, tile));
  return kept.length === 0 ? tiles : kept;
};
