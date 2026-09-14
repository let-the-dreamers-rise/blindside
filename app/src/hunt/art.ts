// Every picture in the hunt, as text. Eight by eight for a tile, eight by ten for a person.
// Drawn in code so there is nothing to license and nothing to download.
// SPDX-License-Identifier: Apache-2.0

import type { Tile } from "./campus.ts";

export const TILE = 32;
/** One drawn pixel of a tile is this many screen pixels. */
export const PIXEL = 4;
export const SPRITE_SCALE = 3;
export const SPRITE_WIDTH = 8 * SPRITE_SCALE;
export const SPRITE_HEIGHT = 10 * SPRITE_SCALE;

export type Art = readonly string[];
/** Character to colour. A character with no colour is left transparent. */
export type Palette = Readonly<Record<string, string>>;
export type Picture = { readonly art: Art; readonly palette: Palette };

const GRASS: Palette = { g: "#1b261a", d: "#16200f", l: "#26361f" };

export const GRASS_VARIANTS: readonly Picture[] = [
  {
    palette: GRASS,
    art: ["gggggggg", "ggdggggg", "gggggglg", "gggggggg", "gdgggggg", "gggggdgg", "gggggggg", "ggglgggg"],
  },
  {
    palette: GRASS,
    art: ["gggggggg", "gggggggg", "gdgggggg", "ggggglgg", "gggggggg", "gggdgggg", "glgggggg", "gggggggg"],
  },
  {
    palette: GRASS,
    art: ["ggggdggg", "gggggggg", "gggggggg", "glgggggg", "gggggdgg", "gggggggg", "ggdggggg", "gggggggl"],
  },
];

export const GROUND: Readonly<Record<Exclude<Tile, "grass" | "tree" | "bench">, Picture>> = {
  path: {
    palette: { p: "#3a3429", s: "#4a443c", k: "#2e2922" },
    art: ["pppppppp", "pspppppp", "ppppppkp", "pppppppp", "pppspppp", "pppppppp", "pkpppspp", "pppppppp"],
  },
  wall: {
    palette: { w: "#4a4238", m: "#3b352c" },
    art: ["wwwmwwww", "wwwmwwww", "mmmmmmmm", "wmwwwwwm", "wmwwwwwm", "mmmmmmmm", "wwwmwwww", "wwwmwwww"],
  },
  door: {
    palette: { w: "#4a4238", o: "#2b2621", d: "#7a4f27", k: "#e8c170" },
    art: ["wwwwwwww", "woooooow", "woddddow", "woddddow", "woddkdow", "woddddow", "woddddow", "woddddow"],
  },
  floor: {
    palette: { p: "#5e4d3c", l: "#4f4032", n: "#3d3126" },
    art: ["pppppppp", "pppppppp", "llllllll", "pppppppp", "pnpppppp", "llllllll", "pppppppp", "ppppppnp"],
  },
  water: {
    palette: { w: "#1d3f5c", r: "#2c5f86" },
    art: ["wwwwwwww", "wwrwwwww", "wwwwwwrw", "wwwwwwww", "wrwwwwww", "wwwwwrww", "wwwwwwww", "wwwrwwww"],
  },
};

/** Drawn over grass. */
export const TREE: Picture = {
  palette: { c: "#1e3d25", h: "#2e5c36", k: "#152b1a", t: "#3d2a1b" },
  art: ["...cc...", "..cccc..", ".chcccc.", ".cccchc.", ".kkcckk.", "...tt...", "...tt...", "........"],
};

export const BENCH: Picture = {
  palette: { b: "#6a5234", k: "#3d2e1c" },
  art: ["........", "........", "bbbbbbbb", "kkkkkkkk", "........", ".k....k.", ".k....k.", "........"],
};

/** A lit window, drawn over a wall on the front of a building. */
export const WINDOW: Picture = {
  palette: { y: "#e8c170", b: "#fff0c0", f: "#2b2621" },
  art: ["........", "..ffff..", "..fyyf..", "..fbyf..", "..fyyf..", "..ffff..", "........", "........"],
};

/** Two frames: standing, and mid-step. Flipped in CSS to face the other way. */
export const PERSON: readonly Art[] = [
  ["..hhhh..", ".hhhhhh.", ".hffffh.", ".heffeh.", "..ffff..", ".ssssss.", "s.ssss.s", "..ssss..", ".pp..pp.", ".bb..bb."],
  ["..hhhh..", ".hhhhhh.", ".hffffh.", ".heffeh.", "..ffff..", ".ssssss.", ".ssssss.", "..ssss..", "..pppp..", ".b....b."],
];

export type Look = { readonly shirt: string; readonly hair: string };

/** You wear paper. Everybody else wears a colour you can tell apart at a distance. */
export const LOOKS: readonly Look[] = [
  { shirt: "#efe9dd", hair: "#2a2320" },
  { shirt: "#d98c3f", hair: "#1a1412" },
  { shirt: "#5f8f5a", hair: "#6b4a2b" },
  { shirt: "#7a9bc4", hair: "#3b2a1b" },
  { shirt: "#b57bb0", hair: "#2a2320" },
  { shirt: "#c9c14a", hair: "#4a2a1a" },
  { shirt: "#e07a6a", hair: "#1a1412" },
  { shirt: "#67b8b0", hair: "#7a5a3a" },
];

const OUT: Palette = {
  h: "#4a4744",
  f: "#8a857e",
  e: "#3a3733",
  s: "#5a5651",
  p: "#3a3733",
  b: "#262421",
};

export const personPalette = (index: number, out: boolean): Palette => {
  const look = LOOKS[index % LOOKS.length] ?? { shirt: "#888888", hair: "#222222" };
  return out
    ? OUT
    : { h: look.hair, f: "#e9c9a3", e: "#2a2320", s: look.shirt, p: "#2e2b3a", b: "#1a1816" };
};

export const grassVariant = (x: number, y: number): Picture =>
  GRASS_VARIANTS[(x * 7 + y * 13) % GRASS_VARIANTS.length] ?? GRASS_VARIANTS[0] ?? { art: [], palette: {} };
