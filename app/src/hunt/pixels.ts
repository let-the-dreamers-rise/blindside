// Turning text art into pixels. The only file in the hunt that draws on a canvas by hand.
// SPDX-License-Identifier: Apache-2.0

import { type Art, PERSON, type Palette, SPRITE_SCALE, personPalette } from "./art.ts";

export const drawArt = (
  ctx: CanvasRenderingContext2D,
  art: Art,
  palette: Palette,
  x: number,
  y: number,
  scale: number,
): void => {
  art.forEach((row, r) => {
    [...row].forEach((char, c) => {
      const colour = palette[char];
      if (colour !== undefined) {
        ctx.fillStyle = colour;
        ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
      }
    });
  });
};

export const artToDataUrl = (art: Art, palette: Palette, scale: number): string => {
  const canvas = document.createElement("canvas");
  canvas.width = (art[0]?.length ?? 0) * scale;
  canvas.height = art.length * scale;
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return "";
  }
  drawArt(ctx, art, palette, 0, 0, scale);
  return canvas.toDataURL();
};

const sprites = new Map<string, string>();

/** A person, by cast index, standing or mid-step, in colour or greyed out. Drawn once each. */
export const spriteUrl = (index: number, frame: 0 | 1, out: boolean): string => {
  const key = `${index}:${frame}:${out ? "out" : "in"}`;
  const cached = sprites.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const url = artToDataUrl(PERSON[frame] ?? [], personPalette(index, out), SPRITE_SCALE);
  sprites.set(key, url);
  return url;
};
