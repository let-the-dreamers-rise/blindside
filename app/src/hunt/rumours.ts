// What the campus tells you that the chain never will: where people were seen.
// SPDX-License-Identifier: Apache-2.0

import { type World, roomOf } from "./campus.ts";
import { type Point } from "./grid.ts";
import { nearestLandmark } from "./sight.ts";
import { type Facts, type Sim, YOU, visibleFromYou } from "./sim.ts";

/** How often you hear where your target was, in ticks. */
export const RUMOUR_EVERY = 160;

export const rumourAbout = (world: World, name: string, at: Point): string =>
  `${name} was last seen near ${nearestLandmark(world, at).name}.`;

export const ASKING_ABOUT_YOU = "Somebody is asking where you are.";

const movement = (world: World, name: string, before: Point, after: Point): string | null => {
  const from = roomOf(world, before);
  const to = roomOf(world, after);
  if (from === to) {
    return null;
  }
  if (to !== null) {
    return `${name} went into the ${world.rooms[to]?.name ?? "building"}.`;
  }
  return `${name} came out of the ${world.rooms[from ?? -1]?.name ?? "building"}.`;
};

/**
 * What you saw happen between two ticks: somebody you could see going through a door. Only
 * people who were in view both before and after count, which is what makes it a sighting.
 */
export const sightings = (
  world: World,
  before: Sim,
  after: Sim,
  facts: Facts,
  names: readonly string[],
): readonly string[] => {
  const seenBefore = visibleFromYou(before, world, facts);
  const seenAfter = visibleFromYou(after, world, facts);
  return after.actors.flatMap((actor) => {
    const was = before.actors[actor.index];
    const name = names[actor.index];
    if (
      actor.index === YOU ||
      was === undefined ||
      name === undefined ||
      !(facts.alive[actor.index] ?? false) ||
      !(seenBefore.has(actor.index) || seenAfter.has(actor.index))
    ) {
      return [];
    }
    const text = movement(world, name, was.at, actor.at);
    return text === null ? [] : [text];
  });
};
