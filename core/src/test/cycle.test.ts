// The organizer's shuffle. If this is wrong the whole game is wrong: everyone must be hunted by
// exactly one person, and nobody may learn more than their own target.
// SPDX-License-Identifier: Apache-2.0

import { randomBytes } from "@noble/hashes/utils";
import { describe, expect, it } from "vitest";
import { pureCircuits } from "@blindside/contract";
import { toHex } from "../crypto/text.js";
import { newIdentity } from "../crypto/keys.js";
import { LEAF_SLOTS, type PlayerCard, buildStartPlan } from "../game/cycle.js";
import { SEALED_BYTES, openParts, sealNothing } from "../game/sealed.js";

/**
 * Cards with throwaway keys. Deriving a real one costs a deliberate fraction of a second, and
 * the shape of the cycle does not depend on whose key is on the card.
 */
const lobby = (size: number): readonly PlayerCard[] =>
  Array.from({ length: size }, (_, index) => ({
    commitment: newIdentity().commitment,
    wordPublicKey: randomBytes(32),
    sealedTagToken: sealNothing(randomBytes),
    name: `Player ${index}`,
  }));

describe("building a game", () => {
  it("puts everyone in one cycle", () => {
    const cards = lobby(8);
    const plan = buildStartPlan(cards);

    const next = new Map(
      plan.assignments.map((a) => [toHex(a.player), toHex(a.target)]),
    );
    const start = plan.assignments[0];
    expect(start).toBeDefined();

    const visited = new Set<string>();
    let current = toHex(start?.player ?? new Uint8Array());
    for (let step = 0; step < cards.length; step += 1) {
      expect(visited.has(current)).toBe(false);
      visited.add(current);
      current = next.get(current) ?? "";
    }

    // One lap visits everyone and comes back to the start: a single cycle, not two small ones.
    expect(visited.size).toBe(cards.length);
    expect(current).toBe(toHex(start?.player ?? new Uint8Array()));
  });

  it("never makes anyone hunt themselves", () => {
    const plan = buildStartPlan(lobby(6));
    plan.assignments.forEach((assignment) => {
      expect(toHex(assignment.target)).not.toBe(toHex(assignment.player));
    });
  });

  it("publishes the same shaped bundle whoever is playing", () => {
    [3, 5, 16].forEach((size) => {
      const plan = buildStartPlan(lobby(size));
      // Padded regardless of headcount, so neither the tree nor the bundle leaks how many are in.
      expect(plan.leaves).toHaveLength(LEAF_SLOTS);
      expect(plan.items).toHaveLength(LEAF_SLOTS * 2);
      plan.items.forEach((item) => expect(item).toHaveLength(SEALED_BYTES));
    });
  });

  it("includes a real leaf for every player", () => {
    const plan = buildStartPlan(lobby(5));
    const published = new Set(plan.leaves.map(toHex));

    plan.assignments.forEach((assignment) => {
      const leaf = pureCircuits.leafOf(assignment.player, {
        target: assignment.target,
        rand: assignment.rand,
      });
      expect(published.has(toHex(leaf))).toBe(true);
    });
  });

  it("carries every player's own sealed tag token through untouched", () => {
    const cards = lobby(4);
    const plan = buildStartPlan(cards);
    const published = new Set(plan.items.map(toHex));

    cards.forEach((card) => {
      expect(published.has(toHex(card.sealedTagToken))).toBe(true);
    });
  });

  it("tells a stranger nothing", () => {
    const plan = buildStartPlan(lobby(4));
    const outsider = randomBytes(32);
    expect(openParts(outsider, plan.items)).toEqual({
      assignment: null,
      tagToken: null,
    });
  });

  it("refuses a lobby that is too small or too large", () => {
    expect(() => buildStartPlan(lobby(2))).toThrow(/three players/);
    expect(() => buildStartPlan(lobby(17))).toThrow(/up to 16/);
  });

  it("does not put players in the order they joined", () => {
    const cards = lobby(12);
    const joinOrder = cards.map((card) => toHex(card.commitment)).join("");

    const sameOrder = Array.from({ length: 8 }, () => {
      const plan = buildStartPlan(cards);
      return plan.assignments.map((a) => toHex(a.player)).join("") === joinOrder;
    }).filter(Boolean);

    // With 12 players the chance of matching join order even once is negligible.
    expect(sameOrder).toHaveLength(0);
  });
});
