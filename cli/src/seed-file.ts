// Where a scripted run keeps its wallet seed: one gitignored file per network, never printed.
// Losing it only costs test tokens, so there is no recovery path and no reason to want one.
// SPDX-License-Identifier: Apache-2.0

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { newSeed } from "@blindside/chain";

const seedPath = (network: string): string =>
  path.resolve(process.cwd(), "..", "secrets", `${network}.seed`);

export const seedExists = (network: string): boolean => existsSync(seedPath(network));

export const loadOrCreateSeed = (network: string): string => {
  const file = seedPath(network);
  if (existsSync(file)) {
    return readFileSync(file, "utf8").trim();
  }
  mkdirSync(path.dirname(file), { recursive: true });
  const seed = newSeed();
  writeFileSync(file, `${seed}\n`, { mode: 0o600 });
  return seed;
};
