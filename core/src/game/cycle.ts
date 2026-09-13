// The organizer's job: turn a lobby into one secret cycle, and publish it so that each player
// can read only their own part of it.
// SPDX-License-Identifier: Apache-2.0

import { randomBytes } from "@noble/hashes/utils";
import { pureCircuits } from "@blindside/contract";
import { sanitizeName } from "../crypto/text.js";
import {
  type Assignment,
  type SealedItem,
  sealAssignment,
  sealNothing,
} from "./sealed.js";

export const LEAF_SLOTS = 16;

/** What a player hands the organizer when they join. Every field of it is public. */
export type PlayerCard = {
  readonly commitment: Uint8Array;
  /** Derived from the five words this player will say if they are tagged. */
  readonly wordPublicKey: Uint8Array;
  /** Sealed by the player, to themselves. The organizer carries it without ever opening it. */
  readonly sealedTagToken: SealedItem;
  readonly name: string;
};

export type PlacedAssignment = Assignment & {
  readonly player: Uint8Array;
};

export type StartPlan = {
  readonly assignments: readonly PlacedAssignment[];
  readonly leaves: readonly Uint8Array[];
  /** Everything anybody needs, sealed and shuffled. Safe to paste anywhere. */
  readonly items: readonly SealedItem[];
};

export type Rng = (length: number) => Uint8Array;

/**
 * Builds a single cycle over every player, so following targets from anyone reaches everyone and
 * comes back. Leaves and sealed items are padded to a fixed count and shuffled independently, so
 * the tree does not reveal how many people are playing and the published bundle says nothing
 * about who is in it.
 */
export const buildStartPlan = (
  cards: readonly PlayerCard[],
  rng: Rng = randomBytes,
): StartPlan => {
  if (cards.length < 3) {
    throw new Error("A game needs at least three players");
  }
  if (cards.length > LEAF_SLOTS) {
    throw new Error(`This version supports up to ${LEAF_SLOTS} players`);
  }

  const order = shuffle(cards, rng);
  const assignments = order.map((card, index) => {
    const target = order[(index + 1) % order.length];
    if (target === undefined) {
      throw new Error("unreachable: empty cycle");
    }
    return {
      player: card.commitment,
      target: target.commitment,
      rand: rng(32),
      targetName: sanitizeName(target.name),
      generation: 0,
    };
  });

  const realLeaves = assignments.map((assignment) =>
    pureCircuits.leafOf(assignment.player, {
      target: assignment.target,
      rand: assignment.rand,
    }),
  );
  const leafPadding = Array.from({ length: LEAF_SLOTS - realLeaves.length }, () =>
    rng(32),
  );

  const sealedAssignments = order.map((card, index) => {
    const assignment = assignments[index];
    if (assignment === undefined) {
      throw new Error("unreachable: assignment missing");
    }
    return sealAssignment(card.wordPublicKey, assignment);
  });
  const tagTokens = order.map((card) => card.sealedTagToken);
  const itemPadding = Array.from(
    { length: (LEAF_SLOTS - cards.length) * 2 },
    () => sealNothing(rng),
  );

  return {
    assignments,
    leaves: shuffle([...realLeaves, ...leafPadding], rng),
    items: shuffle([...sealedAssignments, ...tagTokens, ...itemPadding], rng),
  };
};

/** Fisher-Yates with real randomness; never sorts by a random comparator. */
const shuffle = <T>(items: readonly T[], rng: Rng): readonly T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = randomIndex(index + 1, rng);
    const a = result[index];
    const b = result[swap];
    if (a === undefined || b === undefined) {
      throw new Error("unreachable: shuffle index out of range");
    }
    result[index] = b;
    result[swap] = a;
  }
  return result;
};

/** Rejection sampling, so every position is equally likely. */
const randomIndex = (bound: number, rng: Rng): number => {
  const limit = Math.floor(0x100000000 / bound) * bound;
  for (;;) {
    const bytes = rng(4);
    const value =
      ((bytes[0] ?? 0) << 24) +
      ((bytes[1] ?? 0) << 16) +
      ((bytes[2] ?? 0) << 8) +
      (bytes[3] ?? 0);
    const unsigned = value >>> 0;
    if (unsigned < limit) {
      return unsigned % bound;
    }
  }
};
