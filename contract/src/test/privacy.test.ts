// What the chain is allowed to know. These tests are the product promise, written as code.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { pureCircuits } from "../managed/blindside/contract/index.js";
import { BlindsideGame, Player, hex } from "../simulator.js";

const liveGame = () => {
  const alex = new Player("alex");
  const bo = new Player("bo");
  const cam = new Player("cam");
  const dee = new Player("dee");
  const order = [alex, bo, cam, dee];
  const game = new BlindsideGame();
  order.forEach((player) => game.join(player));
  game.start(order);
  return { game, alex, bo, cam, dee, order };
};

/** Everything an observer can read out of the public ledger, as hex. */
const publicSurface = (game: BlindsideGame): readonly string[] => {
  const state = game.ledger();
  return [
    ...[...state.players].map(hex),
    ...[...state.payouts].flatMap(([key, value]) => [hex(key), hex(value)]),
    ...[...state.spent].map(hex),
    ...[...state.deadDrops].map(([key]) => hex(key)),
  ];
};

describe("a tag on the public ledger", () => {
  it("never publishes the hunter or the victim", () => {
    const { game, alex, bo, order } = liveGame();
    const before = publicSurface(game);

    game.tag(alex, bo);

    const added = publicSurface(game).filter((item) => !before.includes(item));
    // Exactly two nullifiers appear, and nothing else.
    expect(added).toHaveLength(2);

    const identities = order.flatMap((player) => [
      hex(player.commitment),
      hex(player.tagToken),
      hex(player.payout),
    ]);
    added.forEach((item) => expect(identities).not.toContain(item));
  });

  it("leaves the player list untouched, so eliminations are not public", () => {
    const { game, alex, bo, order } = liveGame();
    const before = [...game.ledger().players].map(hex).sort();

    game.tag(alex, bo);

    expect([...game.ledger().players].map(hex).sort()).toEqual(before);
    expect(order.every((player) => game.ledger().players.member(player.commitment))).toBe(true);
  });

  it("does not let an observer recompute the new note", () => {
    const { game, alex, bo, cam } = liveGame();
    game.tag(alex, bo);

    // An observer knows every commitment. Without the private randomness, the note they can
    // build is not the note in the tree.
    const guess = pureCircuits.leafOf(alex.commitment, {
      target: cam.commitment,
      rand: new Uint8Array(32),
    });
    expect(game.ledger().edges.findPathForLeaf(guess)).toBeUndefined();

    const real = game.noteOf(alex);
    expect(real).toBeDefined();
    if (real !== undefined) {
      const leaf = pureCircuits.leafOf(alex.commitment, real);
      expect(game.ledger().edges.findPathForLeaf(leaf)).toBeDefined();
    }
  });
});

describe("unlinkability", () => {
  it("gives the same pair of players a different note every time", () => {
    const alex = new Player("alex");
    const bo = new Player("bo");
    const first = pureCircuits.leafOf(alex.commitment, {
      target: bo.commitment,
      rand: new Uint8Array(32).fill(1),
    });
    const second = pureCircuits.leafOf(alex.commitment, {
      target: bo.commitment,
      rand: new Uint8Array(32).fill(2),
    });
    expect(hex(first)).not.toBe(hex(second));
  });

  it("keeps a nullifier unrelated to the note it retires", () => {
    const alex = new Player("alex");
    const bo = new Player("bo");
    const edge = { target: bo.commitment, rand: new Uint8Array(32).fill(5) };

    const leaf = pureCircuits.leafOf(alex.commitment, edge);
    const nullifier = pureCircuits.nullifierOf(edge);

    expect(hex(nullifier)).not.toBe(hex(leaf));
    expect(hex(nullifier)).not.toBe(hex(alex.commitment));
    expect(hex(nullifier)).not.toBe(hex(bo.commitment));
  });

  it("does not repeat any value across two tags by the same hunter", () => {
    const { game, alex, bo, cam } = liveGame();

    game.tag(alex, bo);
    const afterFirst = [...game.ledger().spent].map(hex);
    game.tag(alex, cam);
    const afterSecond = [...game.ledger().spent].map(hex);

    const added = afterSecond.filter((item) => !afterFirst.includes(item));
    expect(added).toHaveLength(2);
    expect(new Set(afterSecond).size).toBe(afterSecond.length);
  });
});
