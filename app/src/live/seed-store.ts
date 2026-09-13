// Where a host's game wallet seed lives: this browser, and nowhere else.
//
// It never leaves the tab, is never sent anywhere, and is never shown. A browser that refuses
// storage still plays a game perfectly well; the wallet just does not come back next visit.
// SPDX-License-Identifier: Apache-2.0

const seedKey = (network: string): string => `blindside:seed:${network}`;

export const storedSeed = (network: string): string | null => {
  try {
    return window.localStorage.getItem(seedKey(network));
  } catch {
    return null;
  }
};

export const rememberSeed = (network: string, seed: string): void => {
  try {
    window.localStorage.setItem(seedKey(network), seed);
  } catch {
    // Storage is a convenience here, not a requirement.
  }
};
