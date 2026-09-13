// A whole handover, end to end: five people join, the organizer publishes one line of text, and
// a tag happens because somebody said five words out loud.
//
// This is the test that decides whether the product works. If the thing a hunter gets out of
// spoken words is not exactly what the contract checks, there is no game.
// SPDX-License-Identifier: Apache-2.0

import { randomBytes } from "@noble/hashes/utils";
import { describe, expect, it } from "vitest";
import { pureCircuits } from "@blindside/contract";
import { type Identity, newIdentity } from "../crypto/keys.js";
import { toHex } from "../crypto/text.js";
import { newWordCode, readWordCode, wordCodeText } from "../crypto/words.js";
import { BundleError, decodeBundle, encodeBundle } from "../game/bundle.js";
import { buildStartPlan } from "../game/cycle.js";
import {
  type GameKeys,
  joinCard,
  keysForGame,
  myAssignment,
  republish,
  surrenderFromWords,
} from "../game/player.js";
import { SEALED_BYTES, sealNothing } from "../game/sealed.js";

const GAME = "0200c0ffee11";
const NAMES = ["Alex", "Bo", "Cam", "Dee", "Eve"] as const;

type Seat = {
  readonly identity: Identity;
  readonly keys: GameKeys;
  readonly name: string;
};

/** Built once: five real key derivations are five deliberate fractions of a second. */
const seats: readonly Seat[] = NAMES.map((name) => {
  const identity = newIdentity();
  return { identity, keys: keysForGame(identity.words, GAME), name };
});

const cards = seats.map((seat) => joinCard(seat.identity, seat.keys, seat.name));
const plan = buildStartPlan(cards);
const published = decodeBundle(encodeBundle({ game: GAME, items: plan.items }), GAME);

const seatOf = (commitment: Uint8Array): Seat => {
  const seat = seats.find(
    (candidate) => toHex(candidate.identity.commitment) === toHex(commitment),
  );
  if (seat === undefined) {
    throw new Error("that commitment is not in this game");
  }
  return seat;
};

describe("reading your own game out of the bundle", () => {
  it("tells every player exactly one target, and it is the right one", () => {
    const expected = new Map(
      plan.assignments.map((a) => [toHex(a.player), a] as const),
    );

    seats.forEach((seat) => {
      const mine = myAssignment(seat.keys, published.items);
      const assignment = expected.get(toHex(seat.identity.commitment));

      expect(mine).not.toBeNull();
      expect(toHex(mine?.target ?? new Uint8Array())).toBe(
        toHex(assignment?.target ?? new Uint8Array()),
      );
      expect(mine?.targetName).toBe(seatOf(assignment?.target ?? new Uint8Array()).name);
    });
  });

  it("tells somebody who is not in the game nothing at all", () => {
    const outsider = keysForGame(newWordCode(), GAME);
    expect(myAssignment(outsider, published.items)).toBeNull();
    expect(surrenderFromWords(outsider.words, GAME, published.items)).toBeNull();
  });
});

describe("a tag, from five spoken words", () => {
  it("gives the hunter exactly what the contract checks", () => {
    const hunter = seats[0];
    if (hunter === undefined) {
      throw new Error("no players");
    }
    const mine = myAssignment(hunter.keys, published.items);
    expect(mine).not.toBeNull();

    const victim = seatOf(mine?.target ?? new Uint8Array());

    // The victim says their words; the hunter types what they heard, punctuation and all.
    const heard = readWordCode(`${wordCodeText(victim.identity.words).toUpperCase()}.`);
    expect(heard).not.toBeNull();

    const surrender = surrenderFromWords(heard ?? [], GAME, published.items);
    expect(surrender).not.toBeNull();

    // This is the assertion inside tag(): the token behind the name the hunter was given.
    expect(toHex(pureCircuits.playerOf(surrender?.tagToken ?? new Uint8Array()))).toBe(
      toHex(victim.identity.commitment),
    );
    expect(toHex(surrender?.tagToken ?? new Uint8Array())).toBe(
      toHex(victim.identity.tagToken),
    );

    // And the victim's own outgoing note, which the hunter inherits.
    const victimsOwn = myAssignment(victim.keys, published.items);
    expect(toHex(surrender?.target ?? new Uint8Array())).toBe(
      toHex(victimsOwn?.target ?? new Uint8Array()),
    );
    expect(toHex(surrender?.rand ?? new Uint8Array())).toBe(
      toHex(victimsOwn?.rand ?? new Uint8Array()),
    );
  });

  it("gives nothing for words nobody said", () => {
    expect(surrenderFromWords(newWordCode(), GAME, published.items)).toBeNull();
  });

  it("gives nothing for the right words in the wrong game", () => {
    const victim = seats[1];
    if (victim === undefined) {
      throw new Error("no players");
    }
    expect(
      surrenderFromWords(victim.identity.words, "0200ffffffff", published.items),
    ).toBeNull();
  });

  it("needs both halves: an assignment alone cannot tag anybody", () => {
    const victim = seats[2];
    if (victim === undefined) {
      throw new Error("no players");
    }
    // A bundle with the tag tokens stripped out, leaving only what the organizer sealed.
    const tokens = new Set(cards.map((card) => toHex(card.sealedTagToken)));
    const withoutTokens = published.items.filter((item) => !tokens.has(toHex(item)));
    expect(surrenderFromWords(victim.identity.words, GAME, withoutTokens)).toBeNull();
  });
});

describe("after a tag", () => {
  it("gives a hunter's next hunter the new target, not the old one", () => {
    const hunter = seats[3];
    if (hunter === undefined) {
      throw new Error("no players");
    }
    const before = myAssignment(hunter.keys, published.items);
    expect(before).not.toBeNull();

    // The hunter tags, inherits their victim's target, and republishes under fresh randomness.
    const inherited = {
      target: randomBytes(32),
      rand: randomBytes(32),
      targetName: "Someone else",
      generation: 1,
    };
    const updated = [...published.items, republish(hunter.keys, inherited)];

    const after = myAssignment(hunter.keys, updated);
    expect(toHex(after?.target ?? new Uint8Array())).toBe(toHex(inherited.target));
    expect(after?.generation).toBe(1);

    // And whoever is hunting them now gets the live note, not the one they started with.
    const surrender = surrenderFromWords(hunter.identity.words, GAME, updated);
    expect(toHex(surrender?.rand ?? new Uint8Array())).toBe(toHex(inherited.rand));
    expect(toHex(surrender?.rand ?? new Uint8Array())).not.toBe(
      toHex(before?.rand ?? new Uint8Array()),
    );
  });

  it("refuses a generation that could never fit in an item", () => {
    const seat = seats[0];
    if (seat === undefined) {
      throw new Error("no players");
    }
    expect(() =>
      republish(seat.keys, {
        target: randomBytes(32),
        rand: randomBytes(32),
        targetName: "x",
        generation: 256,
      }),
    ).toThrow(/generation/);
  });
});

describe("the bundle itself", () => {
  it("survives a round trip through a group chat", () => {
    const text = encodeBundle({ game: GAME, items: plan.items });
    expect(text.startsWith("blindside1.")).toBe(true);
    expect(decodeBundle(`  ${text}\n`, GAME).items).toEqual(plan.items);
  });

  it("refuses a bundle from another game rather than quietly finding nothing", () => {
    const text = encodeBundle({ game: GAME, items: plan.items });
    expect(() => decodeBundle(text, "0200999999")).toThrow(BundleError);
    expect(() => decodeBundle(text, "0200999999")).toThrow(/different game/);
  });

  it("refuses rubbish instead of guessing", () => {
    expect(() => decodeBundle("", GAME)).toThrow(/not a Blindside bundle/);
    expect(() => decodeBundle("hello", GAME)).toThrow(/not a Blindside bundle/);
    expect(() => decodeBundle(`blindside1.${GAME}.!!!!`, GAME)).toThrow(/not a Blind/);
    expect(() => decodeBundle(`blindside1.${GAME}.QUJD`, GAME)).toThrow(/not a Blind/);
    expect(() => decodeBundle(`blindside0.${GAME}.QUJD`, GAME)).toThrow(/not a Blind/);
  });

  it("refuses anything oversized before decoding it", () => {
    expect(() => decodeBundle(`blindside1.${GAME}.${"A".repeat(40_000)}`, GAME)).toThrow(
      /too long/,
    );
    expect(() =>
      encodeBundle({
        game: GAME,
        items: Array.from({ length: 65 }, () => sealNothing(randomBytes)),
      }),
    ).toThrow(/at most 64/);
  });

  it("refuses to build one out of things that are not sealed items", () => {
    expect(() =>
      encodeBundle({ game: GAME, items: [new Uint8Array(SEALED_BYTES - 1)] }),
    ).toThrow(/not a sealed item/);
    expect(() => encodeBundle({ game: "not an address!", items: [] })).toThrow(
      /not a game address/,
    );
  });
});
