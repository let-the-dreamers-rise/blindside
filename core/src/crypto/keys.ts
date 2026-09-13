// Player identity. One secret per player, everything else derived from it, so there is exactly
// one thing in the world a player has to keep.
// SPDX-License-Identifier: Apache-2.0

import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { randomBytes } from "@noble/hashes/utils";
import { pureCircuits } from "@blindside/contract";
import { WORD_COUNT, type WordCode, wordsFromBytes } from "./words.js";

export const SECRET_BYTES = 32;

const WORDS_INFO = "blindside:words:v1";

/**
 * Everything a player is, on chain and off.
 *
 * `secret` never leaves the device. `commitment` is the pseudonym published at join. `tagToken`
 * is the preimage behind it, which nobody else can have and which a hunter needs. `words` are
 * what the player says out loud when they agree to be tagged: they are derived from the secret,
 * so a restored secret restores the whole player, codes and all.
 */
export type Identity = {
  readonly secret: Uint8Array;
  readonly tagToken: Uint8Array;
  readonly commitment: Uint8Array;
  readonly words: WordCode;
};

export const newSecret = (): Uint8Array => randomBytes(SECRET_BYTES);

/** The player's surrender words. Deterministic, so they are never something else to back up. */
export const wordsFrom = (secret: Uint8Array): WordCode => {
  assertSecret(secret);
  return wordsFromBytes(hkdf(sha256, secret, undefined, WORDS_INFO, WORD_COUNT * 2));
};

export const identityFrom = (secret: Uint8Array): Identity => {
  assertSecret(secret);
  const tagToken = pureCircuits.tagTokenOf(secret);
  return {
    secret,
    tagToken,
    commitment: pureCircuits.playerOf(tagToken),
    words: wordsFrom(secret),
  };
};

export const newIdentity = (): Identity => identityFrom(newSecret());

function assertSecret(secret: Uint8Array): void {
  if (secret.length !== SECRET_BYTES) {
    throw new Error(`A player secret must be ${SECRET_BYTES} bytes`);
  }
}
