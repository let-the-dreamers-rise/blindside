// The money always gets out. Named after the four ways a real game breaks:
// someone refuses to surrender, someone loses their phone, someone drops out,
// and the winner never claims.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { Phase } from "../managed/blindside/contract/index.js";
import { BlindsideGame, Player } from "../simulator.js";

const DEADLINE = 1_000_000n;
const BEFORE = 1_000;
const AFTER = 2_000_000;

const gameOfThree = (entryFee = 10n) => {
  const alex = new Player("alex");
  const bo = new Player("bo");
  const cam = new Player("cam");
  const order = [alex, bo, cam];
  const game = new BlindsideGame({
    entryFee,
    deadline: DEADLINE,
    startTime: BEFORE,
  });
  order.forEach((player) => game.join(player));
  return { game, alex, bo, cam, order };
};

describe("the deadline", () => {
  it("refuses to open refunds while the game still has time", () => {
    const { game, order } = gameOfThree();
    game.start(order);
    expect(() => game.openRefunds()).toThrow(/deadline/i);
  });

  it("opens refunds once the clock runs out", () => {
    const { game, order } = gameOfThree();
    game.start(order);

    game.setTime(AFTER);
    game.openRefunds();

    expect(game.ledger().phase).toBe(Phase.timedOut);
  });

  it("refuses new joins after the deadline", () => {
    const { game } = gameOfThree();
    game.setTime(AFTER);
    expect(() => game.join(new Player("late"))).toThrow(/expired/);
  });
});

describe("a player who refuses to surrender", () => {
  it("cannot keep the pot: everyone gets their fee back", () => {
    const { game, alex, bo, cam, order } = gameOfThree(10n);
    game.start(order);
    // bo simply never shows their code. The game cannot finish.
    expect(game.ledger().pot).toBe(30n);

    game.setTime(AFTER);
    game.openRefunds();
    [alex, bo, cam].forEach((player) => game.refund(player));

    expect(game.ledger().pot).toBe(0n);
  });

  it("gains nothing by refusing, because refunds reach tagged players too", () => {
    const { game, alex, bo, cam, order } = gameOfThree();
    game.start(order);
    game.tag(alex, bo); // bo is out, and still entitled to a refund

    game.setTime(AFTER);
    game.openRefunds();
    game.refund(bo);

    expect(game.ledger().pot).toBe(20n);
  });
});

describe("a player who loses their phone", () => {
  it("does not strand the other players' money", () => {
    const { game, alex, bo, cam, order } = gameOfThree();
    game.start(order);
    // cam's device is gone: no code, no tags, no claim, ever.
    game.setTime(AFTER);
    game.openRefunds();

    game.refund(alex);
    game.refund(bo);

    expect(game.ledger().pot).toBe(10n);
  });
});

describe("a player who quits", () => {
  it("hands their slot to their own hunter and nobody else", () => {
    const { game, alex, bo, cam, order } = gameOfThree();
    game.start(order);

    game.resign(bo);
    const drop = game.ledger().deadDrops.lookup(bo.commitment);

    // Only bo's hunter holds a note pointing at bo, so only alex can use this.
    expect(() => game.tag(cam, bo, drop)).toThrow(/not your target/);
    game.tag(alex, bo, drop);

    expect(game.ledger().aliveCount).toBe(2n);
    expect(game.noteOf(alex)?.target).toEqual(cam.commitment);
  });
});

describe("a winner who never claims", () => {
  it("still lets the pot out after the deadline", () => {
    const { game, alex, bo, cam, order } = gameOfThree();
    game.start(order);
    game.tag(alex, bo);
    game.tag(alex, cam);
    expect(game.ledger().phase).toBe(Phase.finished);

    game.setTime(AFTER);
    game.openRefunds();
    [alex, bo, cam].forEach((player) => game.refund(player));

    expect(game.ledger().pot).toBe(0n);
  });
});

describe("a game that already paid out", () => {
  it("cannot be reopened for refunds", () => {
    const { game, alex, bo, cam, order } = gameOfThree();
    game.start(order);
    game.tag(alex, bo);
    game.tag(alex, cam);
    game.claimVictory(alex);
    expect(game.ledger().pot).toBe(0n);

    game.setTime(AFTER);
    expect(() => game.openRefunds()).toThrow(/already paid out/);
  });
});

describe("refund rules", () => {
  it("pays each player exactly once", () => {
    const { game, alex, order } = gameOfThree();
    game.start(order);
    game.setTime(AFTER);
    game.openRefunds();

    game.refund(alex);
    expect(() => game.refund(alex)).toThrow(/Already refunded/);
  });

  it("refuses anyone who never joined", () => {
    const { game, order } = gameOfThree();
    game.start(order);
    game.setTime(AFTER);
    game.openRefunds();

    expect(() => game.refund(new Player("stranger"))).toThrow(/not in this game/);
  });

  it("refuses refunds while the game is running", () => {
    const { game, alex, order } = gameOfThree();
    game.start(order);
    expect(() => game.refund(alex)).toThrow(/not open/);
  });
});

describe("cancelling in the lobby", () => {
  it("lets the host call it off and pay everyone back", () => {
    const { game, alex, bo, cam } = gameOfThree();

    game.cancel();
    expect(game.ledger().phase).toBe(Phase.cancelled);

    [alex, bo, cam].forEach((player) => game.refund(player));
    expect(game.ledger().pot).toBe(0n);
  });

  it("refuses anyone who is not the host", () => {
    const { game } = gameOfThree();
    expect(() => game.cancelAs(new Uint8Array(32).fill(4))).toThrow(/host/);
  });

  it("refuses once the game has started", () => {
    const { game, order } = gameOfThree();
    game.start(order);
    expect(() => game.cancel()).toThrow(/already started/);
  });
});
