// The ground, painted once, and the little map in the corner, painted whenever you move.
// SPDX-License-Identifier: Apache-2.0

import {
  BENCH,
  GROUND,
  PERSON,
  PIXEL,
  SPRITE_SCALE,
  TILE,
  TREE,
  WINDOW,
  grassVariant,
  personPalette,
} from "./art.ts";
import { type Room, type Tile, type World, tileAt } from "./campus.ts";
import { type Point, indexOf, pointAt } from "./grid.ts";
import { drawArt } from "./pixels.ts";
import type { Ring } from "./ring.ts";

const onGrass = (tile: Tile): tile is "grass" | "tree" | "bench" =>
  tile === "grass" || tile === "tree" || tile === "bench";

const paintTile = (ctx: CanvasRenderingContext2D, world: World, at: Point): void => {
  const tile = tileAt(world, at);
  const x = at.x * TILE;
  const y = at.y * TILE;
  if (tile === null) {
    return;
  }
  if (onGrass(tile)) {
    const grass = grassVariant(at.x, at.y);
    drawArt(ctx, grass.art, grass.palette, x, y, PIXEL);
  } else {
    const picture = GROUND[tile];
    drawArt(ctx, picture.art, picture.palette, x, y, PIXEL);
  }
  if (tile === "tree") {
    drawArt(ctx, TREE.art, TREE.palette, x, y, PIXEL);
  }
  if (tile === "bench") {
    drawArt(ctx, BENCH.art, BENCH.palette, x, y, PIXEL);
  }
};

/** Lit windows along the wall that has the door in it, every other tile. */
const paintWindows = (ctx: CanvasRenderingContext2D, world: World, room: Room): void => {
  const from = room.bounds.x - 1;
  const to = room.bounds.x + room.bounds.w;
  for (let x = from; x <= to; x += 1) {
    const at = { x, y: room.door.y };
    if (tileAt(world, at) === "wall" && (x - from) % 2 === 1) {
      drawArt(ctx, WINDOW.art, WINDOW.palette, x * TILE, at.y * TILE, PIXEL);
    }
  }
};

const paintGlow = (ctx: CanvasRenderingContext2D, at: Point, radius: number, alpha: number): void => {
  const cx = at.x * TILE + TILE / 2;
  const cy = at.y * TILE + TILE / 2;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  glow.addColorStop(0, `rgba(232, 193, 112, ${alpha})`);
  glow.addColorStop(1, "rgba(232, 193, 112, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
};

const paintRim = (ctx: CanvasRenderingContext2D, world: World): void => {
  const water = world.tiles
    .map((tile, index) => (tile === "water" ? pointAt(world, index) : null))
    .filter((tile): tile is Point => tile !== null);
  if (water.length === 0) {
    return;
  }
  const xs = water.map((tile) => tile.x);
  const ys = water.map((tile) => tile.y);
  const x = Math.min(...xs) * TILE;
  const y = Math.min(...ys) * TILE;
  ctx.strokeStyle = "#8a8478";
  ctx.lineWidth = PIXEL;
  ctx.strokeRect(x + PIXEL / 2, y + PIXEL / 2, (Math.max(...xs) + 1) * TILE - x - PIXEL, (Math.max(...ys) + 1) * TILE - y - PIXEL);
};

export const paintGround = (canvas: HTMLCanvasElement, world: World): void => {
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return;
  }
  ctx.imageSmoothingEnabled = false;
  world.tiles.forEach((_, index) => paintTile(ctx, world, pointAt(world, index)));
  world.rooms.forEach((room) => paintWindows(ctx, world, room));
  paintRim(ctx, world);
  world.rooms.forEach((room) => paintGlow(ctx, room.door, TILE * 2.2, 0.22));
  world.landmarks
    .filter((landmark) => landmark.name === "the fountain")
    .forEach((landmark) => paintGlow(ctx, landmark.at, TILE * 3, 0.12));
};

/** A still of the campus with a few people standing on it, for a page that is not the game. */
export const paintPoster = (
  canvas: HTMLCanvasElement,
  world: World,
  people: readonly { readonly at: Point; readonly index: number; readonly facing: 1 | -1 }[],
): void => {
  paintGround(canvas, world);
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return;
  }
  [...people]
    .sort((a, b) => a.at.y - b.at.y)
    .forEach((person) => {
      const art = PERSON[0] ?? [];
      const width = (art[0]?.length ?? 0) * SPRITE_SCALE;
      const x = person.at.x * TILE + (TILE - width) / 2;
      const y = person.at.y * TILE + TILE - art.length * SPRITE_SCALE;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(x + width / 2, y + art.length * SPRITE_SCALE, 9, 3, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.fill();
      if (person.facing === -1) {
        ctx.translate(x * 2 + width, 0);
        ctx.scale(-1, 1);
      }
      drawArt(ctx, art, personPalette(person.index, false), x, y, SPRITE_SCALE);
      ctx.restore();
    });
};

const MINI = 4;


/** The whole campus at four pixels a tile, with you on it and nobody else. */
export const paintMinimap = (
  canvas: HTMLCanvasElement,
  world: World,
  you: Point | null,
  rumour: Point | null = null,
  ring: Ring | null = null,
): void => {
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return;
  }
  ctx.fillStyle = "#0b0a09";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  world.tiles.forEach((tile, index) => {
    const at = pointAt(world, index);
    ctx.fillStyle =
      tile === "water" ? "#2c5f86" : tile === "wall" || tile === "door" ? "#6b5a48" : tile === "floor" ? "#3d3126" : (world.walkable[indexOf(world, at)] ?? false) ? "#2a2e26" : "#141812";
    ctx.fillRect(at.x * MINI, at.y * MINI, MINI, MINI);
  });
  if (ring !== null) {
    const box = {
      x: ring.x0 * MINI,
      y: ring.y0 * MINI,
      w: (ring.x1 - ring.x0 + 1) * MINI,
      h: (ring.y1 - ring.y0 + 1) * MINI,
    };
    ctx.fillStyle = "rgba(11, 8, 6, 0.62)";
    ctx.fillRect(0, 0, canvas.width, box.y);
    ctx.fillRect(0, box.y + box.h, canvas.width, canvas.height - box.y - box.h);
    ctx.fillRect(0, box.y, box.x, box.h);
    ctx.fillRect(box.x + box.w, box.y, canvas.width - box.x - box.w, box.h);
    ctx.strokeStyle = "rgba(194, 57, 47, 0.7)";
    ctx.lineWidth = 1;
    ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
  }
  if (rumour !== null) {
    ctx.strokeStyle = "rgba(232, 193, 112, 0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(rumour.x * MINI + MINI / 2, rumour.y * MINI + MINI / 2, MINI * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (you !== null) {
    ctx.fillStyle = "#c2392f";
    ctx.fillRect(you.x * MINI - 1, you.y * MINI - 1, MINI + 2, MINI + 2);
  }
};
