// The ground, painted once, and the little map in the corner, painted whenever you move.
// SPDX-License-Identifier: Apache-2.0

import { BENCH, GROUND, PIXEL, TILE, TREE, WINDOW, grassVariant } from "./art.ts";
import { type Room, type Tile, type World, tileAt } from "./campus.ts";
import { type Point, indexOf, pointAt } from "./grid.ts";
import { drawArt } from "./pixels.ts";

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

const MINI = 4;

/** The whole campus at four pixels a tile, with you on it and nobody else. */
export const paintMinimap = (canvas: HTMLCanvasElement, world: World, you: Point | null): void => {
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
  if (you !== null) {
    ctx.fillStyle = "#c2392f";
    ctx.fillRect(you.x * MINI - 1, you.y * MINI - 1, MINI + 2, MINI + 2);
  }
};
