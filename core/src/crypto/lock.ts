// Turning five spoken words into the key that opens one player's sealed target.
//
// The organizer seals every player's assignment to a public key, publishes all of them together,
// and cannot open any of them. The matching secret key exists nowhere: it is derived, on demand,
// from the words its owner says out loud. Saying them is what consent to being tagged means, and
// it is the only thing that makes a tag possible.
//
// Argon2id is what makes five words enough. Each guess costs an attacker 19 MiB and a fraction
// of a second, so searching 55 bits of words is out of reach, while the person doing the tagging
// pays for exactly one derivation.
// SPDX-License-Identifier: Apache-2.0

import { x25519 } from "@noble/curves/ed25519";
import { argon2id } from "@noble/hashes/argon2";
import { type WordCode, wordCodeText } from "./words.js";

/** OWASP's low-memory Argon2id profile: 19 MiB, two passes. */
const KDF = { t: 2, m: 19_456, p: 1, dkLen: 32 } as const;

export type WordKeyPair = {
  readonly secretKey: Uint8Array;
  readonly publicKey: Uint8Array;
};

/**
 * The salt is the game's own address, so the same words in two games give two unrelated keys and
 * a sealed target can never be lifted out of one game and dropped into another.
 */
const salt = (game: string): Uint8Array =>
  new TextEncoder().encode(`blindside:words:v1:${game}`);

/**
 * The expensive step, and the only one. Derive once per game and keep it for as long as the tab
 * is open; deriving it again for every envelope would make opening a game unusable.
 */
export const wordKeyPair = (words: WordCode, game: string): WordKeyPair => {
  const secretKey = argon2id(
    new TextEncoder().encode(wordCodeText(words)),
    salt(game),
    KDF,
  );
  return { secretKey, publicKey: x25519.getPublicKey(secretKey) };
};

/** Just the public half: what a player hands the organizer when they join. */
export const wordPublicKey = (words: WordCode, game: string): Uint8Array =>
  wordKeyPair(words, game).publicKey;
