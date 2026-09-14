// Does a hunt that nobody plays still finish? A campus this size can hide eight people for a
// very long time, so before the grounds closed most games ran out the clock and paid nobody.
// Every tag here goes through the compiled contract, so a game that finishes here is a game the
// contract agreed to.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { SandboxRunner } from "../sandbox/engine.ts";
import { CAMPUS, type World } from "./campus.ts";
import { PLACES } from "./places.ts";
import { NO_INPUT, type Facts, type Sim, YOU, newSim, step } from "./sim.ts";

const CAST: readonly string[] = [
  "You",
  "Riya",
  "Sam",
  "Nina",
  "Dev",
  "Tara",
  "Kabir",
  "Zoe",
  "Omar",
  "Ines",
  "Jude",
  "Mei",
];
const ORDINARY = 8;
/** Five minutes at a tick of 150ms, which is what the clock on the screen counts down. */
const WHOLE_GAME = 2_000;
const SEEDS: readonly number[] = [1, 7, 42, 99, 2_026];

const factsOf = (engine: SandboxRunner, practice: boolean): Facts => {
  const alive = engine.aliveFlags();
  return { targets: engine.edges(), alive, practice, youOut: !(alive[YOU] ?? false) };
};

const stillIn = (engine: SandboxRunner): number =>
  engine.aliveFlags().filter((yes) => yes).length;

type Run = {
  readonly sim: Sim;
  readonly finishedAt: number | null;
  readonly refused: number;
};

/**
 * One whole game with nobody at the keyboard. In practice nobody hunts you, so you live to the
 * end: that is the hard case, because the other players will only tag each other where you are
 * not looking, and a watched campus is a campus where nothing happens.
 */
const playItOut = (
  seed: number,
  practice: boolean,
  size: number = ORDINARY,
  world: World = CAMPUS,
): Run & { readonly left: number; readonly survivors: readonly number[] } => {
  const engine = new SandboxRunner(CAST.slice(0, size));
  const run = Array.from({ length: WHOLE_GAME }).reduce<Run>(
    (acc) => {
      if (acc.finishedAt !== null) {
        return acc;
      }
      const facts = factsOf(engine, practice);
      if (facts.alive.filter((yes) => yes).length <= 1) {
        return { ...acc, finishedAt: acc.sim.tick };
      }
      const next = step(acc.sim, world, facts, NO_INPUT);
      const refused = next.events.reduce((count, event) => {
        const pair =
          event.type === "botTag"
            ? ([event.hunter, event.victim] as const)
            : event.type === "caught"
              ? ([event.hunter, YOU] as const)
              : null;
        if (pair === null) {
          return count;
        }
        try {
          engine.tagBetween(pair[0], pair[1]);
          return count;
        } catch {
          return count + 1;
        }
      }, acc.refused);
      return { sim: next.sim, finishedAt: null, refused };
    },
    { sim: newSim(world, seed, size), finishedAt: null, refused: 0 },
  );
  return {
    ...run,
    left: stillIn(engine),
    survivors: engine.aliveFlags().flatMap((yes, index) => (yes ? [index] : [])),
  };
};

describe("a hunt nobody plays", () => {
  const games = SEEDS.map((seed) => playItOut(seed, false));

  it("never asks the contract for a tag it would refuse", () => {
    expect(games.map((game) => game.refused)).toEqual(SEEDS.map(() => 0));
  });

  it("comes down to one player, every time, inside the five minutes", () => {
    expect(games.map((game) => game.left)).toEqual(SEEDS.map(() => 1));
    games.forEach((game) => expect(game.finishedAt).not.toBeNull());
  });

  it("takes long enough to be worth watching", () => {
    games.forEach((game) => expect(game.finishedAt ?? 0).toBeGreaterThan(600));
  });
});

describe("a hunt watched from start to finish", () => {
  const games = SEEDS.map((seed) => playItOut(seed, true));

  it("never asks the contract for a tag it would refuse", () => {
    expect(games.map((game) => game.refused)).toEqual(SEEDS.map(() => 0));
  });

  // Nobody hunts you in practice, so the only tag left undone is the one on you: a game that
  // ends with two players left has played out every tag it was ever able to play out.
  it("plays out every tag it can, leaving you and whoever is hunting you", () => {
    expect(games.map((game) => game.left)).toEqual(SEEDS.map(() => 2));
    games.forEach((game) => expect(game.survivors).toContain(YOU));
  });
});

describe.each(PLACES)("a hunt on $name", ({ world }) => {
  const few = SEEDS.slice(0, 3);
  const hands = few.map((seed) => playItOut(seed, false, ORDINARY, world));
  const watched = few.map((seed) => playItOut(seed, true, ORDINARY, world));

  it("comes down to one player with nobody at the keyboard", () => {
    expect(hands.map((game) => game.left)).toEqual(few.map(() => 1));
  });

  it("plays out every tag it can when it is watched all the way through", () => {
    expect(watched.map((game) => game.left)).toEqual(few.map(() => 2));
  });

  it("never asks the contract for a tag it would refuse", () => {
    expect([...hands, ...watched].map((game) => game.refused)).toEqual(
      [...few, ...few].map(() => 0),
    );
  });
});

describe("a hunt of any size", () => {
  const sizes: readonly number[] = [4, 8, 12];
  // Three seeds rather than five: every size doubles the games played, and the point here is
  // that the size does not change the answer, not another sample of the same size.
  const few = SEEDS.slice(0, 3);
  const hands = sizes.map((size) => ({ size, games: few.map((seed) => playItOut(seed, false, size)) }));
  const watched = sizes.map((size) => ({ size, games: few.map((seed) => playItOut(seed, true, size)) }));

  it("comes down to one player whether four are playing or twelve", () => {
    hands.forEach(({ size, games }) => {
      expect({ size, left: games.map((game) => game.left) }).toEqual({
        size,
        left: few.map(() => 1),
      });
    });
  });

  it("plays out every tag it can when it is watched all the way through", () => {
    watched.forEach(({ size, games }) => {
      expect({ size, left: games.map((game) => game.left) }).toEqual({
        size,
        left: few.map(() => 2),
      });
    });
  });

  it("never asks the contract for a tag it would refuse, at any size", () => {
    [...hands, ...watched].forEach(({ size, games }) => {
      expect({ size, refused: games.map((game) => game.refused) }).toEqual({
        size,
        refused: few.map(() => 0),
      });
    });
  });
});
