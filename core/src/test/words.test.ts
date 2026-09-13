// The five words a tag actually rests on. If these are wrong, either nobody can be tagged or
// anybody can be.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { wordKeyPair } from "../crypto/lock.js";
import { toHex } from "../crypto/text.js";
import {
  WORD_COUNT,
  isWordCode,
  newWordCode,
  readWordCode,
  wordCodeText,
  wordsFromBytes,
} from "../crypto/words.js";

const GAME = "0200a1b2c3";

describe("word codes", () => {
  it("is five words from the list", () => {
    const words = newWordCode();
    expect(words).toHaveLength(WORD_COUNT);
    expect(isWordCode(words)).toBe(true);
  });

  it("does not hand out the same code twice", () => {
    const seen = new Set(
      Array.from({ length: 500 }, () => wordCodeText(newWordCode())),
    );
    expect(seen.size).toBe(500);
  });

  it("reads the same code out of the same bytes, every time", () => {
    const bytes = new Uint8Array(WORD_COUNT * 2).fill(7);
    expect(wordsFromBytes(bytes)).toEqual(wordsFromBytes(bytes));
    expect(() => wordsFromBytes(new Uint8Array(3))).toThrow(/bytes/);
  });

  it("uses the whole list, with no word more likely than another", () => {
    // Two bytes per word and 65536 divides by 2048 exactly, so there is no modulo bias to
    // find. This checks the spread is at least plausible rather than concentrated.
    const counts = new Map<string, number>();
    for (let index = 0; index < 2000; index += 1) {
      for (const word of newWordCode()) {
        counts.set(word, (counts.get(word) ?? 0) + 1);
      }
    }
    expect(counts.size).toBeGreaterThan(1800);
    expect(Math.max(...counts.values()))  .toBeLessThan(25);
  });

  it("reads back what somebody said, however they typed it", () => {
    const words = newWordCode();
    const said = wordCodeText(words);

    expect(readWordCode(said)).toEqual(words);
    expect(readWordCode(said.toUpperCase())).toEqual(words);
    expect(readWordCode(`  ${said.split(" ").join(", ")}.  `)).toEqual(words);
    expect(readWordCode(said.split(" ").join("-"))).toEqual(words);
  });

  it("accepts a word by its first four letters, which is what people hear", () => {
    // Every word in the list is unique in its first four letters, so a heard word only has to
    // start right: "abandon" typed as "abando" still resolves.
    expect(readWordCode("abando ability able about above")).toEqual([
      "abandon",
      "ability",
      "able",
      "about",
      "above",
    ]);
  });

  it("refuses what is not a code rather than guessing", () => {
    expect(readWordCode("")).toBeNull();
    expect(readWordCode("abandon ability able about")).toBeNull();
    expect(readWordCode("abandon ability able about above absent")).toBeNull();
    expect(readWordCode("zzzz yyyy xxxx wwww vvvv")).toBeNull();
    expect(readWordCode("12345 67890 12345 67890 12345")).toBeNull();
  });

  it("knows a code it could work with from one it could not", () => {
    expect(isWordCode(["abandon", "ability", "able", "about", "above"])).toBe(true);
    expect(isWordCode(["abandon", "ability", "able", "about"])).toBe(false);
    expect(isWordCode(["zzzz", "ability", "able", "about", "above"])).toBe(false);
  });
});

describe("the key five words unlock", () => {
  it("is the same key every time, and different for different words", () => {
    const words = newWordCode();
    expect(toHex(wordKeyPair(words, GAME).publicKey)).toBe(
      toHex(wordKeyPair(words, GAME).publicKey),
    );
    expect(toHex(wordKeyPair(words, GAME).publicKey)).not.toBe(
      toHex(wordKeyPair(newWordCode(), GAME).publicKey),
    );
  });

  it("costs enough per guess to put five words out of reach", () => {
    const started = performance.now();
    wordKeyPair(newWordCode(), GAME);
    const ms = performance.now() - started;

    // Five words are 55 bits. At this cost per guess, searching them is measured in millions of
    // years, and the person doing the tagging pays it once. If this ever drops, so does the
    // strength of every code in the game.
    expect(ms).toBeGreaterThan(20);
  });
});
