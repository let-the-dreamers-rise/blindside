import { describe, expect, it } from "vitest";
import { CAMPUS, roomOf } from "./campus.ts";
import { type Point, adjacent, keyOf, walkableAt } from "./grid.ts";
import { SIGHT } from "./sight.ts";
import { ASKING_ABOUT_YOU, rumourAbout, sightings } from "./rumours.ts";
import { CLOSE_AT, CLOSE_OVER, outsideRing, ringAt } from "./ring.ts";
import {
  BOT_TAG_COOLDOWN,
  CATCH_TICKS,
  EXPOSED_EVERY,
  EXTRAS,
  FIRST_BOT_TAG_AFTER,
  GRACE_TICKS,
  SPRINT_DRAIN,
  SPRINT_READY,
  STAMINA_MAX,
  crowdAround,
  inCrowd,
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

/** Most of these tests are about the eight players, so the campus is empty of strangers. */
const alone = (seed: number): Sim => newSim(CAMPUS, seed, 8, 0);

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
    const sim = alone(1);
    expect(sim.actors.map((actor) => actor.at)).toEqual(CAMPUS.spawns);
    expect(() => newSim(CAMPUS, 1, 9)).toThrow(/room for 8/);
  });

  it("scatters strangers outdoors, and they are nobody", () => {
    const sim = newSim(CAMPUS, 5, 8, EXTRAS);
    expect(sim.extras).toHaveLength(EXTRAS);
    expect(sim.extras.every((extra) => walkableAt(CAMPUS, extra.at))).toBe(true);
    expect(sim.extras.every((extra) => extra.index >= 100)).toBe(true);
    const { sim: later } = run(sim, CYCLE, 200);
    expect(later.extras.some((extra, index) => keyOf(extra.at) !== keyOf(sim.extras[index]?.at ?? extra.at))).toBe(true);
  });

  it("is the same game every time for the same seed", () => {
    const walk = (tick: number): Input => ({ ...NO_INPUT, dir: tick % 2 === 0 ? "left" : "down" });
    const a = run(newSim(CAMPUS, 42, 8), CYCLE, 300, walk);
    const b = run(newSim(CAMPUS, 42, 8), CYCLE, 300, walk);
    expect(a.sim).toEqual(b.sim);
    expect(a.events).toEqual(b.events);
    const c = run(newSim(CAMPUS, 43, 8), CYCLE, 300);
    expect(c.sim.actors.slice(1).map((actor) => actor.at)).not.toEqual(a.sim.actors.slice(1).map((actor) => actor.at));
  });
});

describe("running", () => {
  it("covers two tiles a tick and spends stamina doing it", () => {
    const start = withActorAt(alone(1), YOU, { x: 19, y: 9 });
    const { sim } = run(start, PRACTICE, 1, { ...NO_INPUT, dir: "left", sprint: true });
    expect(at(sim, YOU)).toEqual({ x: 17, y: 9 });
    expect(sim.stamina).toBe(STAMINA_MAX - SPRINT_DRAIN);
    expect(sim.sprinting).toBe(true);
  });

  it("runs out, and will not go again until you have some back", () => {
    const running = (tick: number): Input => ({
      ...NO_INPUT,
      dir: tick % 2 === 0 ? "left" : "right",
      sprint: true,
    });
    const start = withActorAt(alone(1), YOU, { x: 19, y: 8 });
    const spent = run(start, PRACTICE, Math.ceil(STAMINA_MAX / SPRINT_DRAIN), running);
    expect(spent.sim.stamina).toBe(0);

    // Still holding the button: it walks, it does not stutter into a step every other tick.
    const limping = run(spent.sim, PRACTICE, SPRINT_READY - 1, running);
    expect(limping.sim.sprinting).toBe(false);
    expect(limping.sim.stamina).toBe(SPRINT_READY - 1);
    // One tick to reach the threshold, the next one to go again.
    expect(run(limping.sim, PRACTICE, 2, running).sim.sprinting).toBe(true);
  });

  it("costs nothing when you are standing still or blocked", () => {
    const wall = withActorAt(alone(1), YOU, { x: 5, y: 7 });
    const { sim } = run(wall, PRACTICE, 5, { ...NO_INPUT, dir: "up", sprint: true });
    expect(sim.stamina).toBe(STAMINA_MAX);
    expect(run(wall, PRACTICE, 5, { ...NO_INPUT, sprint: true }).sim.stamina).toBe(STAMINA_MAX);
  });

  it("is heard: your hunter learns where you were, without seeing you", () => {
    const far = withActorAt(withActorAt(alone(1), YOU, { x: 19, y: 8 }), 7, { x: 19, y: 20 });
    // Far enough not to be seen, and the rumour mill silenced so only the running is heard.
    const start = { ...far, tick: GRACE_TICKS, heard: GRACE_TICKS };
    const { sim, events } = run(start, CYCLE, 1, { ...NO_INPUT, dir: "left", sprint: true });
    expect(events.some((event) => event.type === "heard" && event.hunter === 7)).toBe(true);
    expect(sim.actors[7]?.lastSeen).not.toBeNull();

    const quiet = run(start, CYCLE, 1, { ...NO_INPUT, dir: "left" });
    expect(quiet.events.filter((event) => event.type === "heard")).toEqual([]);
    const away = withActorAt(start, 7, { x: 1, y: 22 });
    expect(run(away, CYCLE, 1, { ...NO_INPUT, dir: "left", sprint: true }).events.filter((e) => e.type === "heard")).toEqual([]);
  });
});

describe("the crowd", () => {
  const CORNER = { x: 19, y: 9 };

  const withExtrasAt = (sim: Sim, tiles: readonly Point[]): Sim => ({
    ...sim,
    extras: tiles.map((tile, index) => ({ ...(sim.extras[0] ?? { index: 100, at: tile, facing: 1 as const, frame: 0 as const, path: [], idle: 0, lastSeen: null, seenAt: -1, closeFor: 0, coolUntil: 0 }), index: 100 + index, at: tile })),
  });

  it("hides you from a hunter two tiles away, but not from one at arm's length", () => {
    const start = withActorAt(withActorAt(alone(2), YOU, CORNER), 7, { x: 19, y: 13 });
    const bare = { ...start, tick: GRACE_TICKS, heard: GRACE_TICKS };
    expect(run(bare, CYCLE, 2).sim.actors[7]?.lastSeen).not.toBeNull();

    const covered = withExtrasAt(bare, [{ x: 18, y: 9 }, { x: 20, y: 9 }]);
    expect(inCrowd(covered, CORNER)).toBe(true);
    expect(run(covered, CYCLE, 2).sim.actors[7]?.lastSeen).toBeNull();

    const close = withActorAt(covered, 7, { x: 19, y: 10 });
    expect(run(close, CYCLE, 2).sim.actors[7]?.lastSeen).not.toBeNull();
  });

  it("needs more than one stranger to be a crowd", () => {
    const sim = withExtrasAt(alone(2), [{ x: 18, y: 9 }]);
    expect(crowdAround(sim, CORNER)).toBe(1);
    expect(inCrowd(sim, CORNER)).toBe(false);
  });
});

describe("walking", () => {
  it("moves you one tile per tick and turns you to face the way you went", () => {
    const start = alone(1);
    const { sim } = run(start, PRACTICE, 3, { ...NO_INPUT, dir: "left" });
    expect(at(sim, YOU)).toEqual({ x: at(start, YOU).x - 3, y: at(start, YOU).y });
    expect(sim.actors[YOU]?.facing).toBe(-1);
  });

  it("does not let you walk through a wall or through somebody", () => {
    const start = withActorAt(withActorAt(alone(1), YOU, { x: 5, y: 7 }), 1, { x: 4, y: 7 });
    const intoWall = step(start, CAMPUS, PRACTICE, { ...NO_INPUT, dir: "up" });
    expect(at(intoWall.sim, YOU)).toEqual({ x: 5, y: 7 });
    const intoPerson = step(start, CAMPUS, PRACTICE, { ...NO_INPUT, dir: "left" });
    expect(at(intoPerson.sim, YOU)).toEqual({ x: 5, y: 7 });
    expect(intoPerson.sim.actors[YOU]?.facing).toBe(-1);
  });

  it("walks to a tapped tile and stops there", () => {
    const start = withActorAt(alone(1), YOU, { x: 19, y: 9 });
    const first = step(start, CAMPUS, PRACTICE, { ...NO_INPUT, tapped: { x: 25, y: 9 } });
    expect(first.sim.actors[YOU]?.path.length).toBe(5);
    const { sim } = run(first.sim, PRACTICE, 10);
    expect(at(sim, YOU)).toEqual({ x: 25, y: 9 });
  });

  it("follows somebody until it is standing next to them", () => {
    const start = withActorAt(alone(7), YOU, { x: 19, y: 9 });
    const first = step(start, CAMPUS, PRACTICE, { ...NO_INPUT, follow: 4 });
    const { sim } = run(first.sim, PRACTICE, 120);
    expect(adjacent(at(sim, YOU), at(sim, 4))).toBe(true);
    expect(sim.follow).toBe(4);
  });

  it("never puts two living people on one tile or anybody in a wall", () => {
    const inputs: Input[] = ["up", "down", "left", "right"].map((dir) => ({ ...NO_INPUT, dir: dir as Input["dir"] }));
    const { sim } = run(alone(5), CYCLE, 600, (tick) => inputs[Math.floor(tick / 7) % 4] ?? NO_INPUT);
    const tiles = sim.actors.map((actor) => keyOf(actor.at));
    expect(new Set(tiles).size).toBe(tiles.length);
    expect(sim.actors.every((actor) => walkableAt(CAMPUS, actor.at))).toBe(true);
  });
});

describe("the bots", () => {
  it("wander, and go indoors now and then", () => {
    const { sim } = run(alone(9), PRACTICE, 400);
    const moved = sim.actors.slice(1).filter((actor, index) => keyOf(actor.at) !== keyOf(CAMPUS.spawns[index + 1] ?? actor.at));
    expect(moved.length).toBeGreaterThanOrEqual(6);
    const tour = run(alone(9), PRACTICE, 1200);
    expect(tour.sim.actors.slice(1).some((actor) => roomOf(CAMPUS, actor.at) !== null) || moved.length > 0).toBe(true);
  });

  it("tag each other only after the opening, only out of your sight, and not twice in a row", () => {
    const far = withActorAt(withActorAt(withActorAt(alone(3), YOU, { x: 1, y: 22 }), 2, { x: 36, y: 8 }), 3, { x: 37, y: 8 });
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
    const start = withActorAt(withActorAt(withActorAt(alone(6), YOU, { x: 30, y: 8 }), 2, { x: 32, y: 8 }), 3, { x: 33, y: 8 });
    const primed = { ...start, actors: start.actors.map((actor) => (actor.index === 2 ? { ...actor, lastSeen: { x: 33, y: 8 }, seenAt: 0 } : actor)) };
    const { sim, events } = run(primed, CYCLE, 30);
    expect(events.filter((event) => event.type === "botTag")).toEqual([]);
    expect(sim.actors[2]?.coolUntil).toBeGreaterThan(0);
    expect(adjacent(at(sim, 2), at(sim, 3))).toBe(false);
  });

  it("leave you alone for the first half minute, even standing right there", () => {
    const close = withActorAt(withActorAt(alone(2), YOU, { x: 20, y: 8 }), 7, { x: 22, y: 8 });
    const { events } = run(close, CYCLE, GRACE_TICKS - 2);
    expect(events.filter((event) => event.type === "caught" || event.type === "botTag")).toEqual([]);
  });

  it("catch you when your hunter stands next to you long enough", () => {
    const close = { ...withActorAt(withActorAt(alone(2), YOU, { x: 20, y: 8 }), 7, { x: 22, y: 8 }), tick: GRACE_TICKS };
    const { events, sim } = run(close, CYCLE, CATCH_TICKS * 2 + 12);
    expect(events.some((event) => event.type === "caught" && event.hunter === 7)).toBe(true);
    expect(sim.actors[7]?.closeFor).toBe(0);
  });

  it("cannot catch you while you keep moving, and never in practice", () => {
    const close = { ...withActorAt(withActorAt(alone(2), YOU, { x: 20, y: 8 }), 7, { x: 22, y: 8 }), tick: GRACE_TICKS };
    const running = run(close, CYCLE, 40, (tick) => ({ ...NO_INPUT, dir: tick % 20 < 10 ? "left" : "right" }));
    expect(running.events.filter((event) => event.type === "caught")).toEqual([]);
    const practice = run(close, PRACTICE, 300);
    expect(practice.events.filter((event) => event.type === "caught")).toEqual([]);
  });

  it("hear where you are every so often, and you hear that they asked", () => {
    const start = withActorAt(alone(2), 7, { x: 1, y: 22 });
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
    const { sim } = run(alone(4), out, 200);
    expect(at(sim, 3)).toEqual(CAMPUS.spawns[3]);
  });
});

describe("what you can see", () => {
  it("is the people near you outdoors, everyone in practice, everyone once you are out", () => {
    const sim = withActorAt(withActorAt(alone(1), 1, { x: 21, y: 9 }), 2, { x: 38, y: 22 });
    expect([...visibleFromYou(sim, CAMPUS, CYCLE)]).toContain(1);
    expect([...visibleFromYou(sim, CAMPUS, CYCLE)]).not.toContain(2);
    expect(visibleFromYou(sim, CAMPUS, PRACTICE).size).toBe(8);
    expect(visibleFromYou(sim, CAMPUS, { ...CYCLE, youOut: true }).size).toBe(8);
  });

  it("tells you when somebody in view goes through a door", () => {
    const outside = withActorAt(withActorAt(alone(1), YOU, { x: 8, y: 8 }), 1, { x: 6, y: 7 });
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

describe("the closing grounds", () => {
  const SHUT = CLOSE_AT + CLOSE_OVER;
  /** Nobody hunting anybody, so the only thing moving people is where they are allowed to be. */
  const STROLLING: Facts = { ...CYCLE, targets: NAMES.map(() => null) };
  const OUT_THERE: Point = { x: 1, y: 8 };
  const IN_HERE: Point = { x: 19, y: 13 };

  it("leaves the whole campus open until its hour", () => {
    expect(run(newSim(CAMPUS, 3, 8, EXTRAS), CYCLE, 2).sim.ring).toBeNull();
  });

  it("draws the crowd in rather than sending it home", () => {
    const shutting = { ...newSim(CAMPUS, 3, 8, EXTRAS), tick: SHUT };
    const after = run(shutting, STROLLING, 400).sim;
    expect(after.extras).toHaveLength(EXTRAS);
    expect(after.extras.filter((extra) => outsideRing(after.ring, extra.at))).toEqual([]);
  });

  it("gives anybody walking to a closed place somewhere else to be", () => {
    const shutting = { ...newSim(CAMPUS, 3, 8, EXTRAS), tick: SHUT };
    const goals = run(shutting, STROLLING, 40).sim.extras
      .filter((extra) => extra.path.length > 0)
      .map((extra) => extra.path[extra.path.length - 1] ?? OUT_THERE);
    expect(goals.length).toBeGreaterThan(0);
    expect(goals.filter((goal) => outsideRing(ringAt(CAMPUS, SHUT), goal))).toEqual([]);
  });

  it("tells your hunter where you are while you stand outside it", () => {
    const start = withActorAt({ ...alone(4), tick: SHUT }, YOU, OUT_THERE);
    const after = run(start, CYCLE, EXPOSED_EVERY + 2);
    expect(after.events.some((event) => event.type === "exposed")).toBe(true);
    expect(after.sim.actors[yourHunter(CYCLE) ?? -1]?.lastSeen).not.toBeNull();
  });

  it("says nothing about you while you stay inside it", () => {
    const start = withActorAt({ ...alone(4), tick: SHUT }, YOU, IN_HERE);
    const after = run(start, CYCLE, EXPOSED_EVERY + 2);
    expect(after.events.some((event) => event.type === "exposed")).toBe(false);
  });

  it("never gives you away in practice", () => {
    const start = withActorAt({ ...alone(4), tick: SHUT }, YOU, OUT_THERE);
    const after = run(start, PRACTICE, EXPOSED_EVERY + 2);
    expect(after.events.some((event) => event.type === "exposed")).toBe(false);
  });

  it("only ever sends the other players somewhere still open", () => {
    // Every destination anybody is given while the grounds are shut, not just where they end up.
    const walked = Array.from({ length: 200 }).reduce<{
      readonly sim: Sim;
      readonly goals: readonly Point[];
    }>(
      (acc) => {
        const sim = step(acc.sim, CAMPUS, STROLLING, NO_INPUT).sim;
        const goals = sim.actors
          .filter((actor) => actor.index !== YOU && actor.path.length > 0)
          .map((actor) => actor.path[actor.path.length - 1] ?? OUT_THERE);
        return { sim, goals: [...acc.goals, ...goals] };
      },
      { sim: { ...alone(9), tick: SHUT }, goals: [] },
    );
    expect(walked.goals.length).toBeGreaterThan(0);
    expect(walked.goals.filter((goal) => outsideRing(walked.sim.ring, goal))).toEqual([]);
  });
});
