// The happy path, end to end: people join, the host starts, tags land, one player is left.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { Phase } from "../managed/blindside/contract/index.js";
import { BlindsideGame, Player } from "./game.js";

const cast = () => ({
  alex: new Player("alex"),
  bo: new Player("bo"),
  cam: new Player("cam"),
  dee: new Player("dee"),
});

describe("lobby", () => {
  it("escrows one entry fee per player", () => {
    const game = new BlindsideGame({ entryFee: 10n });
    const { alex, bo } = cast();

    game.join(alex);
    game.join(bo);

    expect(game.ledger().pot).toBe(20n);
    expect(game.ledger().playerCount).toBe(2n);
    expect(game.ledger().players.member(alex.commitment)).toBe(true);
    expect(game.ledger().phase).toBe(Phase.lobby);
  });

  it("binds each player's payout address at join", () => {
    const game = new BlindsideGame();
    const { alex } = cast();

    game.join(alex);

    expect(game.ledger().payouts.lookup(alex.commitment)).toEqual(alex.payout);
  });

  it("publishes no names, only commitments", () => {
    const game = new BlindsideGame();
    const { alex, bo, cam } = cast();
    [alex, bo, cam].forEach((player) => game.join(player));

    const published = [...game.ledger().players];

    expect(published).toHaveLength(3);
    published.forEach((entry) => expect(entry).toHaveLength(32));
  });
});

describe("starting", () => {
  it("goes live with everyone alive and a padded tree", () => {
    const game = new BlindsideGame();
    const { alex, bo, cam } = cast();
    const order = [alex, bo, cam];
    order.forEach((player) => game.join(player));

    game.start(order);

    expect(game.ledger().phase).toBe(Phase.live);
    expect(game.ledger().aliveCount).toBe(3n);
    // 16 leaves regardless of headcount, so the tree does not leak how many are playing.
    expect(game.ledger().edges.firstFree()).toBe(16n);
  });
});

describe("tagging", () => {
  it("lets a hunter tag their target and inherit the next one", () => {
    const game = new BlindsideGame();
    const { alex, bo, cam } = cast();
    const order = [alex, bo, cam];
    order.forEach((player) => game.join(player));
    game.start(order);

    game.tag(alex, bo);

    expect(game.ledger().tagCount).toBe(1n);
    expect(game.ledger().aliveCount).toBe(2n);
    expect(game.noteOf(alex)?.target).toEqual(cam.commitment);
    expect(game.noteOf(bo)).toBeUndefined();
  });

  it("spends two notes and creates one on every tag", () => {
    const game = new BlindsideGame();
    const { alex, bo, cam, dee } = cast();
    const order = [alex, bo, cam, dee];
    order.forEach((player) => game.join(player));
    game.start(order);

    const before = game.ledger().edges.firstFree();
    game.tag(alex, bo);

    expect(game.ledger().spent.size()).toBe(2n);
    expect(game.ledger().edges.firstFree()).toBe(before + 1n);
  });

  it("finishes when one player is left", () => {
    const game = new BlindsideGame();
    const { alex, bo, cam } = cast();
    const order = [alex, bo, cam];
    order.forEach((player) => game.join(player));
    game.start(order);

    game.tag(alex, bo);
    game.tag(alex, cam);

    expect(game.ledger().phase).toBe(Phase.finished);
    expect(game.ledger().aliveCount).toBe(1n);
    // The winner ends up hunting themselves: that self-loop is the proof of victory.
    expect(game.noteOf(alex)?.target).toEqual(alex.commitment);
  });
});

describe("winning", () => {
  it("pays the whole pot out and leaves nothing behind", () => {
    const game = new BlindsideGame({ entryFee: 25n });
    const { alex, bo, cam } = cast();
    const order = [alex, bo, cam];
    order.forEach((player) => game.join(player));
    game.start(order);
    game.tag(alex, bo);
    game.tag(alex, cam);

    expect(game.ledger().pot).toBe(75n);
    game.claimVictory(alex);

    expect(game.ledger().pot).toBe(0n);
  });
});
