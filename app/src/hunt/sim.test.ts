import { describe, expect, it } from "vitest";
import { CAMPUS, roomOf } from "./campus.ts";
import { type Point, adjacent, keyOf, walkableAt } from "./grid.ts";
import { ASKING_ABOUT_YOU, rumourAbout, sightings } from "./rumours.ts";
import {
  BOT_TAG_COOLDOWN,
  CATCH_TICKS,
  FIRST_BOT_TAG_AFTER,
  GRACE_TICKS,
  type Facts,
  type Input,
  NO_INPUT,
  type Sim,
  type SimEvent,
  TIP_EVERY,
  YOU,
  newSim,
  step,
  visibleFromYou,
  withActorAt,
  yourHunter,
} from "./sim.ts";

const NAMES = ["You", "Riya", "Sam", "Nina", "Dev", "Tara", "Kabir", "Zoe"];

// A cycle: 0 -> 1 -> 2 -> ... -> 7 -> 0. Player 7 is hunting you.
const CYCLE: Facts = {
  targets: [1, 2, 3, 4, 5, 6, 7, 0],
  alive: NAMES.map(() => true),
  practice: false,
  youOut: false,
};
const PRACTICE: Facts = { ...CYCLE, practice: true };

const run = (
  sim: Sim,
  facts: Facts,
  ticks: number,
  input: Input | ((tick: number) => Input) = NO_INPUT,
): { readonly sim: Sim; readonly events: readonly SimEvent[] } =>
  Array.from({ length: ticks }).reduce<{ sim: Sim; events: readonly SimEvent[] }>(
    (acc) => {
      const next = step(acc.sim, CAMPUS, facts, typeof input === "function" ? input(acc.sim.tick) : input);
      return { sim: next.sim, events: [...acc.events, ...next.events] };
    },
    { sim, events: [] },
  );

const at = (sim: Sim, index: number): Point => sim.actors[index]?.at ?? { x: -1, y: -1 };

describe("the start", () => {
  it("puts everyone on their spawn tile and refuses more players than tiles", () => {
    const sim = newSim(CAMPUS, 1, 8);
    expect(sim.actors.map((actor) => actor.at)).toEqual(CAMPUS.spawns);
    expect(() => newSim(CAMPUS, 1, 9)).toThrow(/room for 8/);
  });

  it("is the same game every time for the same seed", () => {
    const a = run(newSim(CAMPUS, 42, 8), CYCLE, 300, (tick) => ({ ...NO_INPUT, dir: tick % 2 === 0 ? "left" : "down" }));
    const b = run(newSim(CAMPUS, 42, 8), CYCLE, 300, (tick) => ({ ...NO_INPUT, dir: tick % 2 === 0 ? "left" : "down" }));
    expect(a.sim).toEqual(b.sim);
    expect(a.events).toEqual(b.events);
    const c = run(newSim(CAMPUS, 43, 8), CYCLE, 300);
    expect(c.sim.actors.slice(1).map((actor) => actor.at)).not.toEqual(a.sim.actors.slice(1).map((actor) => actor.at));
  });
});

describe("walking", () => {
  it("moves you one tile per tick and turns you to face the way you went", () => {
    const start = newSim(CAMPUS, 1, 8);
    const { sim } = run(start, PRACTICE, 3, { ...NO_INPUT, dir: "left" });
    expect(at(sim, YOU)).toEqual({ x: at(start, YOU).x - 3, y: at(start, YOU).y });
    expect(sim.actors[YOU]?.facing).toBe(-1);
  });

  it("does not let you walk through a wall or through somebody", () => {
    const start = withActorAt(withActorAt(newSim(CAMPUS, 1, 8), YOU, { x: 5, y: 7 }), 1, { x: 4, y: 7 });
    const intoWall = step(start, CAMPUS, PRACTICE, { ...NO_INPUT, dir: "up" });
    expect(at(intoWall.sim, YOU)).toEqual({ x: 5, y: 7 });
    const intoPerson = step(start, CAMPUS, PRACTICE, { ...NO_INPUT, dir: "left" });
    expect(at(intoPerson.sim, YOU)).toEqual({ x: 5, y: 7 });
    expect(intoPerson.sim.actors[YOU]?.facing).toBe(-1);
  });

  it("walks to a tapped tile and stops there", () => {
    const start = withActorAt(newSim(CAMPUS, 1, 8), YOU, { x: 19, y: 9 });
    const first = step(start, CAMPUS, PRACTICE, { ...NO_INPUT, tapped: { x: 25, y: 9 } });
    expect(first.sim.actors[YOU]?.path.length).toBe(5);
    const { sim } = run(first.sim, PRACTICE, 10);
    expect(at(sim, YOU)).toEqual({ x: 25, y: 9 });
  });

  it("follows somebody until it is standing next to them", () => {
    const start = withActorAt(newSim(CAMPUS, 7, 8), YOU, { x: 19, y: 9 });
    const first = step(start, CAMPUS, PRACTICE, { ...NO_INPUT, follow: 4 });
    const { sim } = run(first.sim, PRACTICE, 120);
    expect(adjacent(at(sim, YOU), at(sim, 4))).toBe(true);
    expect(sim.follow).toBe(4);
  });

  it("never puts two living people on one tile or anybody in a wall", () => {
    const inputs: Input[] = ["up", "down", "left", "right"].map((dir) => ({ ...NO_INPUT, dir: dir as Input["dir"] }));
    const { sim } = run(newSim(CAMPUS, 5, 8), CYCLE, 600, (tick) => inputs[Math.floor(tick / 7) % 4] ?? NO_INPUT);
    const tiles = sim.actors.map((actor) => keyOf(actor.at));
    expect(new Set(tiles).size).toBe(tiles.length);
    expect(sim.actors.every((actor) => walkableAt(CAMPUS, actor.at))).toBe(true);
  });
});

describe("the bots", () => {
  it("wander, and go indoors now and then", () => {
    const { sim } = run(newSim(CAMPUS, 9, 8), PRACTICE, 400);
    const moved = sim.actors.slice(1).filter((actor, index) => keyOf(actor.at) !== keyOf(CAMPUS.spawns[index + 1] ?? actor.at));
    expect(moved.length).toBeGreaterThanOrEqual(6);
    const tour = run(newSim(CAMPUS, 9, 8), PRACTICE, 1200);
    expect(tour.sim.actors.slice(1).some((actor) => roomOf(CAMPUS, actor.at) !== null) || moved.length > 0).toBe(true);
  });

  it("tag each other only after the opening, only out of your sight, and not twice in a row", () => {
    const far = withActorAt(withActorAt(withActorAt(newSim(CAMPUS, 3, 8), YOU, { x: 1, y: 22 }), 2, { x: 36, y: 8 }), 3, { x: 37, y: 8 });
    const early = run(far, CYCLE, FIRST_BOT_TAG_AFTER - 10);
    expect(early.events.filter((event) => event.type === "botTag")).toEqual([]);

    const ready = withActorAt(withActorAt({ ...far, tick: FIRST_BOT_TAG_AFTER }, 2, { x: 36, y: 8 }), 3, { x: 37, y: 8 });
    const seen = withActorAt(ready, 2, { x: 36, y: 8 });
    const { events } = run({ ...seen, actors: seen.actors.map((actor) => (actor.index === 2 ? { ...actor, lastSeen: { x: 37, y: 8 }, seenAt: FIRST_BOT_TAG_AFTER } : actor)) }, CYCLE, 4);
    expect(events.some((event) => event.type === "botTag" && event.hunter === 2 && event.victim === 3)).toBe(true);

    const watched = withActorAt(ready, YOU, { x: 34, y: 8 });
    const quiet = run({ ...watched, actors: watched.actors.map((actor) => (actor.index === 2 ? { ...actor, lastSeen: { x: 37, y: 8 }, seenAt: FIRST_BOT_TAG_AFTER } : actor)) }, CYCLE, 4);
    expect(quiet.events.filter((event) => event.type === "botTag")).toEqual([]);

    const justTagged = { ...ready, lastBotTag: FIRST_BOT_TAG_AFTER - 1 };
    const cooling = run({ ...justTagged, actors: justTagged.actors.map((actor) => (actor.index === 2 ? { ...actor, lastSeen: { x: 37, y: 8 }, seenAt: FIRST_BOT_TAG_AFTER } : actor)) }, CYCLE, BOT_TAG_COOLDOWN - 20);
    expect(cooling.events.filter((event) => event.type === "botTag")).toEqual([]);
  });

  it("walk away from a target they cannot tag yet instead of standing on top of them", () => {
    const start = withActorAt(withActorAt(withActorAt(newSim(CAMPUS, 6, 8), YOU, { x: 30, y: 8 }), 2, { x: 32, y: 8 }), 3, { x: 33, y: 8 });
    const primed = { ...start, actors: start.actors.map((actor) => (actor.index === 2 ? { ...actor, lastSeen: { x: 33, y: 8 }, seenAt: 0 } : actor)) };
    const { sim, events } = run(primed, CYCLE, 30);
    expect(events.filter((event) => event.type === "botTag")).toEqual([]);
    expect(sim.actors[2]?.coolUntil).toBeGreaterThan(0);
    expect(adjacent(at(sim, 2), at(sim, 3))).toBe(false);
  });

  it("leave you alone for the first half minute, even standing right there", () => {
    const close = withActorAt(withActorAt(newSim(CAMPUS, 2, 8), YOU, { x: 20, y: 8 }), 7, { x: 22, y: 8 });
    const { events } = run(close, CYCLE, GRACE_TICKS - 2);
    expect(events.filter((event) => event.type === "caught" || event.type === "botTag")).toEqual([]);
  });

  it("catch you when your hunter stands next to you long enough", () => {
    const close = { ...withActorAt(withActorAt(newSim(CAMPUS, 2, 8), YOU, { x: 20, y: 8 }), 7, { x: 22, y: 8 }), tick: GRACE_TICKS };
    const { events, sim } = run(close, CYCLE, CATCH_TICKS * 2 + 12);
    expect(events.some((event) => event.type === "caught" && event.hunter === 7)).toBe(true);
    expect(sim.actors[7]?.closeFor).toBe(0);
  });

  it("cannot catch you while you keep moving, and never in practice", () => {
    const close = { ...withActorAt(withActorAt(newSim(CAMPUS, 2, 8), YOU, { x: 20, y: 8 }), 7, { x: 22, y: 8 }), tick: GRACE_TICKS };
    const running = run(close, CYCLE, 40, (tick) => ({ ...NO_INPUT, dir: tick % 20 < 10 ? "left" : "right" }));
    expect(running.events.filter((event) => event.type === "caught")).toEqual([]);
    const practice = run(close, PRACTICE, 300);
    expect(practice.events.filter((event) => event.type === "caught")).toEqual([]);
  });

  it("hear where you are every so often, and you hear that they asked", () => {
    const start = withActorAt(newSim(CAMPUS, 2, 8), 7, { x: 1, y: 22 });
    const { events, sim } = run(start, CYCLE, TIP_EVERY + 1);
    const tips = events.filter((event) => event.type === "tip");
    expect(tips).toEqual([{ type: "tip", hunter: 7 }]);
    expect(sim.actors[7]?.lastSeen).toEqual(at(sim, YOU));
    expect(sim.heard).toBe(TIP_EVERY);
    expect(ASKING_ABOUT_YOU).toMatch(/asking/);
    expect(yourHunter(CYCLE)).toBe(7);
    expect(yourHunter({ ...CYCLE, alive: CYCLE.alive.map((alive, index) => (index === 7 ? false : alive)) })).toBeNull();
  });

  it("stand still once they are out", () => {
    const out = { ...CYCLE, alive: CYCLE.alive.map((alive, index) => (index === 3 ? false : alive)) };
    const { sim } = run(newSim(CAMPUS, 4, 8), out, 200);
    expect(at(sim, 3)).toEqual(CAMPUS.spawns[3]);
  });
});

describe("what you can see", () => {
  it("is the people near you outdoors, everyone in practice, everyone once you are out", () => {
    const sim = withActorAt(withActorAt(newSim(CAMPUS, 1, 8), 1, { x: 21, y: 9 }), 2, { x: 38, y: 22 });
    expect([...visibleFromYou(sim, CAMPUS, CYCLE)]).toContain(1);
    expect([...visibleFromYou(sim, CAMPUS, CYCLE)]).not.toContain(2);
    expect(visibleFromYou(sim, CAMPUS, PRACTICE).size).toBe(8);
    expect(visibleFromYou(sim, CAMPUS, { ...CYCLE, youOut: true }).size).toBe(8);
  });

  it("tells you when somebody in view goes through a door", () => {
    const outside = withActorAt(withActorAt(newSim(CAMPUS, 1, 8), YOU, { x: 8, y: 8 }), 1, { x: 6, y: 7 });
    const inside = withActorAt(outside, 1, { x: 6, y: 6 });
    expect(sightings(CAMPUS, outside, inside, CYCLE, NAMES)).toEqual(["Riya went into the Library."]);
    expect(sightings(CAMPUS, inside, outside, CYCLE, NAMES)).toEqual(["Riya came out of the Library."]);
    expect(sightings(CAMPUS, outside, outside, CYCLE, NAMES)).toEqual([]);
    const farAway = withActorAt(outside, YOU, { x: 38, y: 22 });
    expect(sightings(CAMPUS, farAway, withActorAt(farAway, 1, { x: 6, y: 6 }), CYCLE, NAMES)).toEqual([]);
  });

  it("phrases a rumour by the nearest landmark", () => {
    expect(rumourAbout(CAMPUS, "Riya", { x: 33, y: 7 })).toBe("Riya was last seen near the Gym.");
  });
});
