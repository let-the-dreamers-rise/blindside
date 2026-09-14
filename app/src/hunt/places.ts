// Where a hunt happens. A place is a block of text, its rooms, its landmarks, and where people
// start; everything else about it is worked out from the text by makeWorld.
// SPDX-License-Identifier: Apache-2.0

import { CAMPUS, type World } from "./campus.ts";
import { PARK } from "./park.ts";

export type Place = {
  readonly key: string;
  readonly name: string;
  /** What playing here is like, in three or four words. */
  readonly blurb: string;
  readonly world: World;
};

export const PLACES: readonly Place[] = [
  { key: "campus", name: "The campus", blurb: "rooms and crowds", world: CAMPUS },
  { key: "park", name: "The park", blurb: "trees and open lawn", world: PARK },
];

export const DEFAULT_PLACE = "campus";

const FIRST: Place = PLACES[0] ?? { key: "campus", name: "The campus", blurb: "", world: CAMPUS };

export const placeOf = (key: string | null): Place =>
  PLACES.find((place) => place.key === key) ?? FIRST;
