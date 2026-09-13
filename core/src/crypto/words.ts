// The five words a player says when they agree to be tagged.
//
// A tag needs 96 bytes of the victim's private note, which nobody can read out in a corridor or
// type into a group chat. So the bytes are published as ciphertext and the words are the key.
// Five words from the 2048 word BIP-39 list carry 55 bits, which is short enough to say over a
// video call and, behind a memory-hard key derivation, far out of reach of anyone guessing.
// SPDX-License-Identifier: Apache-2.0

import { randomBytes } from "@noble/hashes/utils";
import { wordlist } from "@scure/bip39/wordlists/english.js";

export const WORD_COUNT = 5;
const BITS_PER_WORD = 11;
const WORDLIST_SIZE = 1 << BITS_PER_WORD;

/** Every word in the list is unique in its first four letters, so near enough is good enough. */
const PREFIX_LENGTH = 4;

export type WordCode = readonly string[];

const prefixes = new Map(
  wordlist.map((word) => [word.slice(0, PREFIX_LENGTH), word] as const),
);

const wordAt = (index: number): string => {
  const word = wordlist[index % WORDLIST_SIZE];
  if (word === undefined) {
    throw new Error("unreachable: the wordlist is 2048 words long");
  }
  return word;
};

/**
 * Reads a code out of bytes. Two bytes per word, and 65536 divides by 2048 exactly, so every
 * word is equally likely and there is no bias to correct for.
 */
export const wordsFromBytes = (bytes: Uint8Array): WordCode => {
  if (bytes.length < WORD_COUNT * 2) {
    throw new Error(`a word code needs ${WORD_COUNT * 2} bytes`);
  }
  return Array.from({ length: WORD_COUNT }, (_, index) => {
    const high = bytes[index * 2] ?? 0;
    const low = bytes[index * 2 + 1] ?? 0;
    return wordAt(((high << 8) | low) % WORDLIST_SIZE);
  });
};

/** A fresh code, from nothing but randomness. */
export const newWordCode = (rng: (length: number) => Uint8Array = randomBytes): WordCode =>
  wordsFromBytes(rng(WORD_COUNT * 2));

/**
 * Reads back what somebody typed or heard.
 *
 * People mishear, autocorrect and add punctuation, so anything that is not a letter separates
 * words, case is ignored, and a word is matched on its first four letters. Returns null when it
 * is not a code rather than guessing at one.
 */
export const readWordCode = (raw: string): WordCode | null => {
  const parts = raw
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((part) => part.length > 0);
  if (parts.length !== WORD_COUNT) {
    return null;
  }

  const words = parts.map((part) => prefixes.get(part.slice(0, PREFIX_LENGTH)) ?? null);
  return words.every((word): word is string => word !== null) ? words : null;
};

/** How a code is shown and said: four lower case words, separated by spaces. */
export const wordCodeText = (words: WordCode): string => words.join(" ");

export const isWordCode = (words: readonly string[]): boolean =>
  words.length === WORD_COUNT && words.every((word) => prefixes.has(word.slice(0, PREFIX_LENGTH)));
