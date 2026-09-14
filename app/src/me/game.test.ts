import { describe, expect, it } from "vitest";
import {
  buildStartPlan,
  encodeBundle,
  joinCard,
  keysForGame,
  newIdentity,
  wordCodeText,
} from "@blindside/core";
import { checkHeard, explainHeard, gameOf, openMyGame } from "./game.ts";

const GAME = "phonetest0001";
const NAMES = ["Asha", "Ben", "Cleo"];

// Three players, one bundle, built once because every key derivation is deliberately slow.
const seats = NAMES.map((name) => {
  const identity = newIdentity();
  return { name, identity, keys: keysForGame(identity.words, GAME) };
});
const plan = buildStartPlan(seats.map((seat) => joinCard(seat.identity, seat.keys, seat.name)));
const bundle = encodeBundle({ game: GAME, items: plan.items });
const [asha, ben, cleo] = seats;

const seatNamed = (name: string) => seats.find((seat) => seat.name === name);

describe("reading the bundle", () => {
  it("names the game before trusting anything in it", () => {
    expect(gameOf(bundle)).toBe(GAME);
    expect(gameOf("hello")).toBeNull();
    expect(gameOf("blindside1..abc")).toBeNull();
  });

  it("opens your own assignment and nobody else's", () => {
    if (asha === undefined) {
      throw new Error("no seats");
    }
    const mine = openMyGame(asha.identity.words, bundle);
    expect(mine.assignment?.targetName).toBeDefined();
    expect(mine.assignment?.targetName).not.toBe("Asha");
    expect(mine.items.length).toBe(32);
  });

  it("refuses text that is not a bundle, with a message a player can read", () => {
    if (asha === undefined) {
      throw new Error("no seats");
    }
    expect(() => openMyGame(asha.identity.words, "not a bundle")).toThrow(/not a Blindside bundle/);
  });

  it("opens nothing for words from another game", () => {
    const stranger = newIdentity();
    expect(openMyGame(stranger.words, bundle).assignment).toBeNull();
  });
});

describe("checking what you heard", () => {
  it("confirms your target's words and nobody else's", () => {
    if (asha === undefined || ben === undefined || cleo === undefined) {
      throw new Error("no seats");
    }
    const mine = openMyGame(asha.identity.words, bundle);
    const target = seatNamed(mine.assignment?.targetName ?? "");
    const other = seats.find((seat) => seat !== target && seat !== asha);
    if (target === undefined || other === undefined) {
      throw new Error("the cycle is broken");
    }
    const yes = checkHeard(mine, wordCodeText(target.identity.words).toUpperCase());
    expect(yes).toEqual({ kind: "yes", name: target.name, said: wordCodeText(target.identity.words) });
    expect(explainHeard(yes)).toBe(`That was ${target.name}.`);

    const wrong = checkHeard(mine, wordCodeText(other.identity.words));
    expect(wrong).toEqual({ kind: "not-target", name: target.name });
    expect(explainHeard(wrong)).toMatch(/not .*'s/);

    expect(checkHeard(mine, "one two")).toEqual({ kind: "not-five" });
    expect(checkHeard(mine, "abandon ability able about above")).toEqual({ kind: "nothing" });
    expect(explainHeard({ kind: "nothing" })).toMatch(/open nothing/);
  });

  it("cannot be a tag when you have no target", () => {
    if (asha === undefined || ben === undefined) {
      throw new Error("no seats");
    }
    const mine = { ...openMyGame(asha.identity.words, bundle), assignment: null };
    expect(checkHeard(mine, wordCodeText(ben.identity.words))).toEqual({ kind: "no-target" });
    expect(explainHeard({ kind: "no-target" })).toMatch(/not hunting/);
  });
});
