// Randomised games, checked against the things that must hold no matter what anybody does.
//
// The other suites assert what should happen in situations we thought of. This one plays games
// we did not think of: random sizes, random orders, random interruptions, and asserts the
// invariants that make the escrow safe.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { Phase } from "../managed/blindside/contract/index.js";
import { BlindsideGame, Player, hex } from "../simulator.js";

// Each move runs the real circuit, which costs about a second, so the sweep is deliberately
// small enough to stay in a normal test run. The seeds are fixed, so a failure is reproducible.
const GAMES = 8;
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 8;
const ENTRY_FEE = 7n;
const DEADLINE = 1_000_000n;
const BEFORE = 1_000;
const AFTER = 2_000_000;

/**
 * A small deterministic generator. Seeded per game so a failure names the seed that produced it
 * and can be replayed exactly.
 */
const rng = (seed: number) => {
  let state = (seed * 2654435761) >>> 0;
  return (bound: number): number => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state % bound;
  };
};

const shuffled = <T>(items: readonly T[], next: (bound: number) => number): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = next(index + 1);
    const a = result[index];
    const b = result[swap];
    if (a === undefined || b === undefined) {
      throw new Error("unreachable");
    }
    result[index] = b;
    result[swap] = a;
  }
  return result;
};

type Fixture = {
  readonly game: BlindsideGame;
  readonly players: readonly Player[];
  readonly order: readonly Player[];
};

const startedGame = (seed: number): Fixture => {
  const next = rng(seed);
  const size = MIN_PLAYERS + next(MAX_PLAYERS - MIN_PLAYERS + 1);
  const players = Array.from(
    { length: size },
    (_, index) => new Player(`p${seed}-${index}`),
  );
  const game = new BlindsideGame({
    entryFee: ENTRY_FEE,
    deadline: DEADLINE,
    startTime: BEFORE,
  });
  players.forEach((player) => game.join(player));
  const order = shuffled(players, next);
  game.start(order);
  return { game, players, order };
};

/** Whoever currently holds a note, in the order the cycle runs. */
const alive = (fixture: Fixture): readonly Player[] =>
  fixture.order.filter((player) => fixture.game.noteOf(player) !== undefined);

/** Plays tags until `remaining` players are left, always tagging a live player's real target. */
const playDownTo = (fixture: Fixture, remaining: number, next: (bound: number) => number) => {
  for (;;) {
    const live = alive(fixture);
    if (live.length <= Math.max(remaining, 1)) {
      return;
    }
    const hunter = live[next(live.length)];
    if (hunter === undefined) {
      throw new Error("unreachable");
    }
    const note = fixture.game.noteOf(hunter);
    if (note === undefined) {
      throw new Error("unreachable");
    }
    const victim = fixture.order.find(
      (player) => hex(player.commitment) === hex(note.target),
    );
    if (victim === undefined || victim === hunter) {
      return;
    }
    fixture.game.tag(hunter, victim);
  }
};

describe("any game at all", () => {
  it("keeps the pot equal to the fees still owed", () => {
    for (let seed = 1; seed <= GAMES; seed += 1) {
      const fixture = startedGame(seed);
      const next = rng(seed + 7919);
      const size = fixture.players.length;

      expect(fixture.game.ledger().pot).toBe(ENTRY_FEE * BigInt(size));

      playDownTo(fixture, 1 + next(size - 1), next);

      // Tags move notes around; they never move money.
      expect(fixture.game.ledger().pot).toBe(ENTRY_FEE * BigInt(size));
    }
  });

  it("ends with exactly one player holding a note, pointing at themselves", () => {
    for (let seed = 1; seed <= GAMES; seed += 1) {
      const fixture = startedGame(seed);
      playDownTo(fixture, 1, rng(seed + 104_729));

      const survivors = alive(fixture);
      expect(survivors).toHaveLength(1);

      const winner = survivors[0];
      if (winner === undefined) {
        throw new Error("unreachable");
      }
      expect(hex(fixture.game.noteOf(winner)?.target ?? new Uint8Array())).toBe(
        hex(winner.commitment),
      );
      expect(fixture.game.ledger().phase).toBe(Phase.finished);
      expect(Number(fixture.game.ledger().aliveCount)).toBe(1);
    }
  });

  it("pays the whole pot to the winner and nothing to anyone else", () => {
    for (let seed = 1; seed <= GAMES; seed += 1) {
      const fixture = startedGame(seed);
      playDownTo(fixture, 1, rng(seed + 15_485_863));

      const winner = alive(fixture)[0];
      if (winner === undefined) {
        throw new Error("unreachable");
      }
      fixture.game.claimVictory(winner);

      expect(fixture.game.ledger().pot).toBe(0n);
      // Nobody else can claim anything afterwards: the game is over, refunds cannot open.
      fixture.game.setTime(AFTER);
      expect(() => fixture.game.openRefunds()).toThrow(/already paid out/);
    }
  });

  it("gives everyone their fee back when it is abandoned, whatever state it stopped in", () => {
    for (let seed = 1; seed <= GAMES; seed += 1) {
      const fixture = startedGame(seed);
      const next = rng(seed + 32_452_843);
      const size = fixture.players.length;

      playDownTo(fixture, 1 + next(size - 1), next);

      fixture.game.setTime(AFTER);
      fixture.game.openRefunds();
      // Refund order is not the join order, and tagged players are entitled too.
      shuffled(fixture.players, next).forEach((player) => fixture.game.refund(player));

      expect(fixture.game.ledger().pot).toBe(0n);
    }
  });

  it("never lets a note be spent twice, however the game went", () => {
    for (let seed = 1; seed <= GAMES; seed += 1) {
      const fixture = startedGame(seed);
      const next = rng(seed + 49_979_687);
      playDownTo(fixture, 1 + next(fixture.players.length - 1), next);

      const spent = [...fixture.game.ledger().spent].map(hex);
      expect(new Set(spent).size).toBe(spent.length);
      // Two spent notes per tag, and nothing else spends anything while a game is running.
      expect(spent.length).toBe(Number(fixture.game.ledger().tagCount) * 2);
    }
  });

  it("tells an observer nothing but counts", () => {
    for (let seed = 1; seed <= GAMES; seed += 1) {
      const fixture = startedGame(seed);
      const before = [...fixture.game.ledger().players].map(hex);
      playDownTo(fixture, 1, rng(seed + 67_867_979));
      const after = [...fixture.game.ledger().players].map(hex);

      // Being tagged does not remove anyone from the public list, so the list cannot be read as
      // a list of survivors.
      expect(after).toEqual(before);
      expect(after).toHaveLength(fixture.players.length);
    }
  });
});
