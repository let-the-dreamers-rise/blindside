// A player's view of one game: the keys their words unlock, the card they hand the organizer,
// and the two things they can read out of the published bundle.
//
// Deriving the keys is the one slow step in the whole product, because it is what makes five
// words unguessable. It happens once per game and the result is kept for as long as the app is
// open, never written down and never sent anywhere.
// SPDX-License-Identifier: Apache-2.0

import { type WordKeyPair, wordKeyPair } from "../crypto/lock.js";
import type { Identity } from "../crypto/keys.js";
import type { WordCode } from "../crypto/words.js";
import type { PlayerCard } from "./cycle.js";
import {
  type Assignment,
  type SealedItem,
  type Surrender,
  openParts,
  sealAssignment,
  sealTagToken,
  surrenderFrom,
} from "./sealed.js";

export type GameKeys = WordKeyPair & {
  readonly words: WordCode;
  readonly game: string;
};

/** The slow step, done once per game. */
export const keysForGame = (words: WordCode, game: string): GameKeys => ({
  ...wordKeyPair(words, game),
  words,
  game,
});

/** What a player hands the organizer to join. Public, and safe to send over anything. */
export const joinCard = (
  identity: Identity,
  keys: GameKeys,
  name: string,
): PlayerCard => ({
  commitment: identity.commitment,
  wordPublicKey: keys.publicKey,
  sealedTagToken: sealTagToken(keys.publicKey, identity.tagToken),
  name,
});

/**
 * What a player publishes once they have tagged somebody: the target they inherited, sealed to
 * their own words at the next generation, so that whoever tags them next gets the live one.
 *
 * The player seals this themselves. Nobody else could: the key belongs to words only they know.
 */
export const republish = (keys: GameKeys, assignment: Assignment): SealedItem =>
  sealAssignment(keys.publicKey, assignment);

/** Who this player is hunting, read out of the bundle everybody can see. */
export const myAssignment = (
  keys: GameKeys,
  items: readonly SealedItem[],
): Assignment | null => openParts(keys.secretKey, items).assignment;

/**
 * Everything a hunter needs, from the words their target just said.
 *
 * Returns null when the words open nothing, which is what a wrong or mistyped code looks like.
 * It never says which player the words belong to, because it does not know: it only knows that
 * something opened.
 */
export const surrenderFromWords = (
  words: WordCode,
  game: string,
  items: readonly SealedItem[],
): Surrender | null =>
  surrenderFrom(openParts(keysForGame(words, game).secretKey, items));
