// Everything that must not work. A game people pay into is defined by what it refuses.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { BlindsideGame, Player } from "./game.js";

const threePlayerGame = () => {
  const alex = new Player("alex");
  const bo = new Player("bo");
  const cam = new Player("cam");
  const order = [alex, bo, cam];
  const game = new BlindsideGame();
  order.forEach((player) => game.join(player));
  return { game, alex, bo, cam, order };
};

describe("joining", () => {
  it("refuses the same player twice", () => {
    const { game, alex } = threePlayerGame();
    expect(() => game.join(alex)).toThrow(/Already joined/);
  });

  it("refuses once the game is full", () => {
    const game = new BlindsideGame({ cap: 2n });
    game.join(new Player("one"));
    game.join(new Player("two"));
    expect(() => game.join(new Player("three"))).toThrow(/full/);
  });

  it("refuses after the game has started", () => {
    const { game, order } = threePlayerGame();
    game.start(order);
    expect(() => game.join(new Player("latecomer"))).toThrow(/already started/);
  });
});

describe("starting", () => {
  it("refuses anyone who is not the host", () => {
    const { game, order } = threePlayerGame();
    expect(() => game.startAs(order, new Uint8Array(32).fill(3))).toThrow(/host/);
  });

  it("refuses a game with fewer than three players", () => {
    const game = new BlindsideGame();
    const alex = new Player("alex");
    const bo = new Player("bo");
    game.join(alex);
    game.join(bo);
    expect(() => game.start([alex, bo])).toThrow(/three players/);
  });

  it("refuses to start twice", () => {
    const { game, order } = threePlayerGame();
    game.start(order);
    expect(() => game.start(order)).toThrow(/already started/);
  });
});

describe("tagging", () => {
  it("refuses a tag on someone who is not your target", () => {
    const { game, alex, cam, order } = threePlayerGame();
    game.start(order);
    // alex hunts bo, not cam
    expect(() => game.tag(alex, cam)).toThrow(/not your target/);
  });

  it("refuses a code photographed by someone who is not the victim's hunter", () => {
    // Four players, so the thief is genuinely not the victim's hunter:
    // alex -> bo -> cam -> dee -> alex.
    const alex = new Player("alex");
    const bo = new Player("bo");
    const cam = new Player("cam");
    const dee = new Player("dee");
    const order = [alex, bo, cam, dee];
    const game = new BlindsideGame();
    order.forEach((player) => game.join(player));
    game.start(order);

    const stolen = game.surrenderOf(cam); // alex photographs cam's screen

    expect(() => game.tag(alex, cam, stolen)).toThrow(/not your target/);
  });

  it("refuses to replay a code that has already been used", () => {
    const { game, alex, bo, order } = threePlayerGame();
    game.start(order);
    const code = game.surrenderOf(bo);
    game.tag(alex, bo, code);

    // A successful tag always moves the hunter on to a new note, so the replay is caught by
    // the target check before it even reaches the spent-note check. Either way the code is dead.
    expect(() => game.tag(alex, bo, code)).toThrow(
      /not your target|already used|out of date/,
    );
  });

  it("refuses a code that went stale because the victim tagged first", () => {
    const alex = new Player("alex");
    const bo = new Player("bo");
    const cam = new Player("cam");
    const dee = new Player("dee");
    const order = [alex, bo, cam, dee];
    const game = new BlindsideGame();
    order.forEach((player) => game.join(player));
    game.start(order);

    const stale = game.surrenderOf(bo);
    game.tag(bo, cam); // bo's own note is replaced here

    expect(() => game.tag(alex, bo, stale)).toThrow(/already used|out of date/);
  });

  it("refuses a made-up code", () => {
    const { game, alex, bo, order } = threePlayerGame();
    game.start(order);
    const forged = {
      tagToken: bo.tagToken,
      target: new Uint8Array(32).fill(7),
      rand: new Uint8Array(32).fill(9),
    };
    expect(() => game.tag(alex, bo, forged)).toThrow(/out of date|Unknown/);
  });

  it("refuses tags before the game starts", () => {
    const { game, alex, bo } = threePlayerGame();
    expect(() => game.tag(alex, bo)).toThrow();
  });
});

describe("claiming", () => {
  it("refuses a claim while the game is running", () => {
    const { game, alex, order } = threePlayerGame();
    game.start(order);
    expect(() => game.claimVictory(alex)).toThrow(/not over/);
  });

  it("refuses a claim from someone who is not the last standing", () => {
    const { game, alex, bo, cam, order } = threePlayerGame();
    game.start(order);
    game.tag(alex, bo);
    game.tag(alex, cam);
    expect(() => game.claimVictory(cam)).toThrow();
  });

  it("refuses a second claim", () => {
    const { game, alex, bo, cam, order } = threePlayerGame();
    game.start(order);
    game.tag(alex, bo);
    game.tag(alex, cam);
    game.claimVictory(alex);
    expect(() => game.claimVictory(alex)).toThrow(/already used/);
  });
});
