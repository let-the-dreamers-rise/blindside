// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { CAMPUS } from "./campus.ts";
import type { Grid } from "./grid.ts";
import {
  CLOSE_AT,
  CLOSE_OVER,
  QUAD_X,
  QUAD_Y,
  closing,
  insideRing,
  outsideRing,
  ringAt,
} from "./ring.ts";

const grid: Grid = CAMPUS;
const shut = CLOSE_AT + CLOSE_OVER;

describe("closing", () => {
  it("leaves the campus alone until its hour", () => {
    expect(closing(0)).toBe(0);
    expect(closing(CLOSE_AT)).toBe(0);
  });

  it("runs from nothing to all of it and stops there", () => {
    expect(closing(CLOSE_AT + 1)).toBeGreaterThan(0);
    expect(closing(shut)).toBe(1);
    expect(closing(shut * 4)).toBe(1);
  });
});

describe("ringAt", () => {
  it("is nothing at all before it starts", () => {
    expect(ringAt(grid, CLOSE_AT)).toBeNull();
  });

  it("still holds the whole campus the moment it starts", () => {
    const ring = ringAt(grid, CLOSE_AT + 1);
    expect(outsideRing(ring, { x: 0, y: 0 })).toBe(false);
    expect(outsideRing(ring, { x: grid.width - 1, y: grid.height - 1 })).toBe(false);
  });

  it("never closes past the quad", () => {
    const ring = ringAt(grid, shut * 3);
    expect(ring).not.toBeNull();
    expect((ring?.x1 ?? 0) - (ring?.x0 ?? 0)).toBe(QUAD_X * 2);
    expect((ring?.y1 ?? 0) - (ring?.y0 ?? 0)).toBe(QUAD_Y * 2);
  });

  it("only ever gets smaller", () => {
    const widths = [0, 200, 400, 600, 800].map((step) => {
      const ring = ringAt(grid, CLOSE_AT + 1 + step);
      return (ring?.x1 ?? 0) - (ring?.x0 ?? 0);
    });
    widths.slice(1).forEach((width, index) => {
      expect(width).toBeLessThanOrEqual(widths[index] ?? 0);
    });
  });

  it("keeps the middle of the campus open to the end", () => {
    const ring = ringAt(grid, shut);
    const middle = { x: Math.round((grid.width - 1) / 2), y: Math.round((grid.height - 1) / 2) };
    expect(outsideRing(ring, middle)).toBe(false);
  });

  it("has shut the far corners by the end", () => {
    const ring = ringAt(grid, shut);
    expect(outsideRing(ring, { x: 0, y: 0 })).toBe(true);
    expect(outsideRing(ring, { x: grid.width - 1, y: grid.height - 1 })).toBe(true);
  });
});

describe("outsideRing", () => {
  it("is false everywhere while nothing has closed", () => {
    expect(outsideRing(null, { x: 0, y: 0 })).toBe(false);
  });
});

describe("insideRing", () => {
  const tiles = [
    { x: 0, y: 0 },
    { x: 19, y: 11 },
  ];

  it("gives back everything when nothing has closed", () => {
    expect(insideRing(null, tiles)).toEqual(tiles);
  });

  it("drops what has been shut", () => {
    expect(insideRing(ringAt(grid, shut), tiles)).toEqual([{ x: 19, y: 11 }]);
  });

  it("would rather strand nobody than hand back nothing", () => {
    const corner = [{ x: 0, y: 0 }];
    expect(insideRing(ringAt(grid, shut), corner)).toEqual(corner);
  });
});
