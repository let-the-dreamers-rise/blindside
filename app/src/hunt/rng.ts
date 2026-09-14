// A small seeded generator, so a game can be replayed exactly and a test can be exact.
// SPDX-License-Identifier: Apache-2.0

/** The whole generator is one 32-bit number. Every draw returns the next one; nothing mutates. */
export type Rng = number;

export const seedRng = (seed: number): Rng => (seed >>> 0) || 0x9e3779b9;

/** mulberry32. A number in [0, 1) and the state to draw from next. */
export const nextRandom = (state: Rng): readonly [number, Rng] => {
  const next = (state + 0x6d2b79f5) >>> 0;
  const a = Math.imul(next ^ (next >>> 15), next | 1);
  const b = a ^ (a + Math.imul(a ^ (a >>> 7), a | 61));
  return [((b ^ (b >>> 14)) >>> 0) / 4294967296, next];
};

export const nextInt = (state: Rng, below: number): readonly [number, Rng] => {
  const [value, next] = nextRandom(state);
  return [Math.floor(value * below), next];
};

export const pick = <T>(state: Rng, items: readonly T[]): readonly [T | undefined, Rng] => {
  const [index, next] = nextInt(state, items.length);
  return [items[index], next];
};
