// The hunt, one tick at a time. Pure: the same state, facts and input always give the same
// next state, which is what lets a game be replayed and a test be exact.
//
// The simulation knows the whole map, who hunts whom, because its bots have to. The screen is
// only ever shown what your own character could see, and the chain panel next to it only what
// the contract was told. Those three views are the product.
// SPDX-License-Identifier: Apache-2.0

import { type World } from "./campus.ts";
import {
  type Dir,
  type Point,
  adjacent,
  findPath,
  findPathToAdjacent,
  keyOf,
  moved,
  same,
  walkableAt,
} from "./grid.ts";
import { type Rng, nextRandom, pick, seedRng } from "./rng.ts";
import { canSee } from "./sight.ts";

export const TICK_MS = 150;
/** Bots stroll: one step every third tick. You take one every tick, so you can outrun anybody. */
export const BOT_STEP_EVERY = 3;
/** Your hunter, once it has seen you, moves faster than a stroll and slower than you. */
export const CHASE_STEP_EVERY = 2;
/** How long a bot remembers where it last saw its target, in ticks. */
export const SIGHT_MEMORY = 45;
/** Move ticks your hunter has to spend next to you before it has you. */
export const CATCH_TICKS = 5;
/** The first half minute is yours: nobody chases you and no bot tags anybody. */
export const GRACE_TICKS = 200;
export const FIRST_BOT_TAG_AFTER = 200;
export const BOT_TAG_COOLDOWN = 110;
/** Every twenty-four seconds or so, your hunter hears roughly where you are. */
export const TIP_EVERY = 160;
/** A bot that reaches its target and cannot tag it walks away and forgets for this long. */
export const GIVE_UP_TICKS = 70;

const IDLE_MIN = 6;
const IDLE_SPREAD = 20;
const REPLAN_EVERY = 3;
const INDOORS_CHANCE = 0.3;

export const YOU = 0;

export type Actor = {
  readonly index: number;
  readonly at: Point;
  readonly facing: 1 | -1;
  readonly frame: 0 | 1;
  readonly path: readonly Point[];
  readonly idle: number;
  readonly lastSeen: Point | null;
  readonly seenAt: number;
  readonly closeFor: number;
  /** No hunting before this tick: the bot gave up on its target for a while. */
  readonly coolUntil: number;
};

export type Sim = {
  readonly tick: number;
  readonly rng: Rng;
  readonly actors: readonly Actor[];
  readonly lastBotTag: number;
  readonly follow: number | null;
  readonly heard: number;
};

/** What the contract says is true. The simulation never decides this itself. */
export type Facts = {
  readonly targets: readonly (number | null)[];
  readonly alive: readonly boolean[];
  /** Nobody hunts you and the roofs are off. For learning the map. */
  readonly practice: boolean;
  readonly youOut: boolean;
};

export type Input = {
  readonly dir: Dir | null;
  readonly tapped: Point | null;
  readonly follow: number | null;
};

export const NO_INPUT: Input = { dir: null, tapped: null, follow: null };

export type SimEvent =
  | { readonly type: "botTag"; readonly hunter: number; readonly victim: number }
  | { readonly type: "caught"; readonly hunter: number }
  | { readonly type: "tip"; readonly hunter: number };

export type Stepped = { readonly sim: Sim; readonly events: readonly SimEvent[] };

export const newSim = (world: World, seed: number, count: number): Sim => {
  if (count > world.spawns.length) {
    throw new Error(`the campus has room for ${world.spawns.length} players`);
  }
  return {
    tick: 0,
    rng: seedRng(seed),
    actors: world.spawns.slice(0, count).map((at, index) => ({
      index,
      at,
      facing: 1,
      frame: 0,
      path: [],
      idle: 0,
      lastSeen: null,
      seenAt: -1,
      closeFor: 0,
      coolUntil: 0,
    })),
    lastBotTag: 0,
    follow: null,
    heard: 0,
  };
};

/** For tests and for placing people deliberately. */
export const withActorAt = (sim: Sim, index: number, at: Point): Sim => ({
  ...sim,
  actors: sim.actors.map((actor) => (actor.index === index ? { ...actor, at, path: [] } : actor)),
});

const replace = (actors: readonly Actor[], actor: Actor): readonly Actor[] =>
  actors.map((each) => (each.index === actor.index ? actor : each));

const done = (acc: Stepped, actor: Actor, events: readonly SimEvent[]): Stepped => ({
  sim: { ...acc.sim, actors: replace(acc.sim.actors, actor) },
  events: [...acc.events, ...events],
});

const occupiedBy = (sim: Sim, facts: Facts, except: number): ReadonlySet<string> =>
  new Set(
    sim.actors
      .filter((actor) => actor.index !== except && (facts.alive[actor.index] ?? false))
      .map((actor) => keyOf(actor.at)),
  );

const facingFor = (from: Point, to: Point, facing: 1 | -1): 1 | -1 =>
  to.x === from.x ? facing : to.x > from.x ? 1 : -1;

const stepTo = (actor: Actor, to: Point, rest: readonly Point[]): Actor => ({
  ...actor,
  at: to,
  facing: facingFor(actor.at, to, actor.facing),
  frame: actor.frame === 0 ? 1 : 0,
  path: rest,
});

/** One step along the path, or a dropped path when somebody is standing in the way. */
const advance = (actor: Actor, occupied: ReadonlySet<string>): Actor => {
  const [next, ...rest] = actor.path;
  if (next === undefined) {
    return actor;
  }
  return occupied.has(keyOf(next)) ? { ...actor, path: [] } : stepTo(actor, next, rest);
};

const fresh = (tick: number, actor: Actor): boolean =>
  actor.lastSeen !== null && tick - actor.seenAt <= SIGHT_MEMORY;

// ------------------------------------------------------------------ you

const planYou = (
  sim: Sim,
  world: World,
  you: Actor,
  occupied: ReadonlySet<string>,
  input: Input,
  follow: number | null,
): Actor => {
  if (input.tapped !== null) {
    const path =
      findPath(world, you.at, input.tapped, occupied) ??
      findPathToAdjacent(world, you.at, input.tapped, occupied) ??
      [];
    return { ...you, path };
  }
  const other = follow === null ? undefined : sim.actors[follow];
  if (other === undefined) {
    return you;
  }
  if (adjacent(you.at, other.at)) {
    return { ...you, path: [] };
  }
  if (you.path.length > 0 && sim.tick % REPLAN_EVERY !== 0) {
    return you;
  }
  return { ...you, path: findPathToAdjacent(world, you.at, other.at, occupied) ?? [] };
};

const stepYou = (sim: Sim, world: World, facts: Facts, input: Input): Sim => {
  const you = sim.actors[YOU];
  if (you === undefined || facts.youOut || !(facts.alive[YOU] ?? false)) {
    return sim;
  }
  const occupied = occupiedBy(sim, facts, YOU);
  if (input.dir !== null) {
    const next = moved(you.at, input.dir);
    const can = walkableAt(world, next) && !occupied.has(keyOf(next));
    const turned = { ...you, path: [], facing: facingFor(you.at, next, you.facing) };
    return { ...sim, follow: null, actors: replace(sim.actors, can ? stepTo(you, next, []) : turned) };
  }
  const follow = input.tapped !== null ? null : (input.follow ?? sim.follow);
  const planned = planYou(sim, world, you, occupied, input, follow);
  return { ...sim, follow, actors: replace(sim.actors, advance(planned, occupied)) };
};

// ----------------------------------------------------------------- bots

const perceive = (sim: Sim, world: World, actor: Actor, prey: Actor | null): Actor =>
  prey !== null && canSee(world, actor.at, prey.at)
    ? { ...actor, lastSeen: prey.at, seenAt: sim.tick }
    : actor;

const pickGoal = (world: World, rng: Rng): readonly [Point, Rng] => {
  const [roll, afterRoll] = nextRandom(rng);
  const [room, afterRoom] = pick(afterRoll, world.rooms);
  if (roll < INDOORS_CHANCE && room !== undefined) {
    const [tile, afterTile] = pick(afterRoom, room.floor);
    return [tile ?? room.door, afterTile];
  }
  const [tile, afterTile] = pick(afterRoom, world.open);
  return [tile ?? { x: 0, y: 0 }, afterTile];
};

const wander = (acc: Stepped, world: World, actor: Actor, occupied: ReadonlySet<string>): Stepped => {
  if (actor.idle > 0) {
    return done(acc, { ...actor, idle: actor.idle - 1 }, []);
  }
  if (actor.path.length === 0) {
    const [goal, rng] = pickGoal(world, acc.sim.rng);
    const path = findPath(world, actor.at, goal, occupied) ?? [];
    const planned = { ...actor, path, idle: path.length === 0 ? 4 : 0 };
    return done({ ...acc, sim: { ...acc.sim, rng } }, planned, []);
  }
  const next = advance(actor, occupied);
  if (next.path.length > 0) {
    return done(acc, next, []);
  }
  const [pause, rng] = nextRandom(acc.sim.rng);
  const idle = IDLE_MIN + Math.floor(pause * IDLE_SPREAD);
  return done({ ...acc, sim: { ...acc.sim, rng } }, { ...next, idle }, []);
};

/** Your hunter, when it knows roughly where you are. Standing next to you long enough is a tag. */
const chase = (
  acc: Stepped,
  world: World,
  actor: Actor,
  you: Actor,
  occupied: ReadonlySet<string>,
): Stepped => {
  if (!fresh(acc.sim.tick, actor)) {
    return wander(acc, world, { ...actor, closeFor: 0 }, occupied);
  }
  const close = adjacent(actor.at, you.at);
  const closeFor = close ? actor.closeFor + 1 : 0;
  if (closeFor >= CATCH_TICKS) {
    return done(acc, { ...actor, closeFor: 0, path: [] }, [{ type: "caught", hunter: actor.index }]);
  }
  const goal = actor.lastSeen ?? you.at;
  const path = close ? [] : (findPathToAdjacent(world, actor.at, goal, occupied) ?? []);
  return done(acc, advance({ ...actor, closeFor, path }, occupied), []);
};

/** Tags between bots happen where you are not looking, the way real ones happen in corridors. */
const botMayTag = (sim: Sim, world: World, facts: Facts, hunter: Actor, prey: Actor): boolean => {
  if (sim.tick < FIRST_BOT_TAG_AFTER || sim.tick - sim.lastBotTag < BOT_TAG_COOLDOWN) {
    return false;
  }
  if (facts.youOut) {
    return true;
  }
  const you = sim.actors[YOU];
  return you === undefined || !(canSee(world, you.at, hunter.at) || canSee(world, you.at, prey.at));
};

const hunt = (
  acc: Stepped,
  world: World,
  facts: Facts,
  actor: Actor,
  prey: Actor,
  occupied: ReadonlySet<string>,
): Stepped => {
  if (adjacent(actor.at, prey.at)) {
    if (!botMayTag(acc.sim, world, facts, actor, prey)) {
      const givenUp = { ...actor, path: [], lastSeen: null, coolUntil: acc.sim.tick + GIVE_UP_TICKS };
      return wander(acc, world, givenUp, occupied);
    }
    const tagged = done(acc, { ...actor, path: [], lastSeen: null }, [
      { type: "botTag", hunter: actor.index, victim: prey.index },
    ]);
    return { ...tagged, sim: { ...tagged.sim, lastBotTag: acc.sim.tick } };
  }
  const keep = actor.path.length > 0 && acc.sim.tick % (REPLAN_EVERY * 2) !== 0;
  const goal = actor.lastSeen ?? prey.at;
  const path = keep ? actor.path : (findPathToAdjacent(world, actor.at, goal, occupied) ?? []);
  return done(acc, advance({ ...actor, path }, occupied), []);
};

const stepBot = (acc: Stepped, index: number, world: World, facts: Facts): Stepped => {
  const actor = acc.sim.actors[index];
  if (actor === undefined || !(facts.alive[index] ?? false)) {
    return acc;
  }
  const target = facts.targets[index] ?? null;
  const prey =
    target === null || !(facts.alive[target] ?? false) ? null : (acc.sim.actors[target] ?? null);
  const aware = perceive(acc.sim, world, actor, prey);
  const chasing =
    prey !== null && target === YOU && !facts.practice && acc.sim.tick >= GRACE_TICKS;
  if ((acc.sim.tick + index) % (chasing ? CHASE_STEP_EVERY : BOT_STEP_EVERY) !== 0) {
    return done(acc, aware, []);
  }
  const occupied = occupiedBy(acc.sim, facts, index);
  if (target === YOU) {
    // You are never a bot's prey in the ordinary sense: catching you is its own thing.
    return chasing && prey !== null ? chase(acc, world, aware, prey, occupied) : wander(acc, world, aware, occupied);
  }
  if (prey !== null && fresh(acc.sim.tick, aware) && acc.sim.tick >= aware.coolUntil) {
    return hunt(acc, world, facts, aware, prey, occupied);
  }
  return wander(acc, world, aware, occupied);
};

/** The rumour mill runs both ways: now and then your hunter hears where you are. */
const tipOff = (acc: Stepped, facts: Facts): Stepped => {
  const { sim } = acc;
  if (facts.practice || facts.youOut || sim.tick - sim.heard < TIP_EVERY) {
    return acc;
  }
  const you = sim.actors[YOU];
  const hunter = sim.actors.find(
    (actor) => facts.targets[actor.index] === YOU && (facts.alive[actor.index] ?? false),
  );
  if (you === undefined || hunter === undefined) {
    return acc;
  }
  const told = { ...hunter, lastSeen: you.at, seenAt: sim.tick };
  return {
    sim: { ...sim, heard: sim.tick, actors: replace(sim.actors, told) },
    events: [...acc.events, { type: "tip", hunter: hunter.index }],
  };
};

export const step = (sim: Sim, world: World, facts: Facts, input: Input): Stepped => {
  const ticked = { ...sim, tick: sim.tick + 1 };
  const start: Stepped = { sim: stepYou(ticked, world, facts, input), events: [] };
  const bots = start.sim.actors
    .slice(1)
    .reduce((acc, actor) => stepBot(acc, actor.index, world, facts), start);
  return tipOff(bots, facts);
};

/** Who your character can currently see. Everyone, once you are out or practising. */
export const visibleFromYou = (sim: Sim, world: World, facts: Facts): ReadonlySet<number> => {
  const you = sim.actors[YOU];
  if (you === undefined || facts.youOut || facts.practice) {
    return new Set(sim.actors.map((actor) => actor.index));
  }
  return new Set(
    sim.actors
      .filter((actor) => actor.index === YOU || canSee(world, you.at, actor.at))
      .map((actor) => actor.index),
  );
};

export const yourHunter = (facts: Facts): number | null => {
  const index = facts.targets.findIndex((target, who) => target === YOU && (facts.alive[who] ?? false));
  return index === -1 ? null : index;
};

export const isAt = (sim: Sim, index: number, at: Point): boolean => {
  const actor = sim.actors[index];
  return actor !== undefined && same(actor.at, at);
};
