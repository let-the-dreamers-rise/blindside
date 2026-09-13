// The host's shuffle. If this is wrong the whole game is wrong: everyone must be hunted by
// exactly one person, and nobody may learn more than their own target.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { pureCircuits } from "@blindside/contract";
import { toHex } from "../crypto/bundle.js";
import { identityFrom, newIdentity } from "../crypto/keys.js";
import { LEAF_SLOTS, buildStartPlan, findMyEnvelope } from "../game/cycle.js";

const lobby = (size: number) =>
  Array.from({ length: size }, (_, index) => {
    const identity = newIdentity();
    return {
      identity,
      card: {
        commitment: identity.commitment,
        encPublicKey: identity.encPublicKey,
        name: `Player ${index}`,
      },
    };
  });

describe("building a game", () => {
  it("puts everyone in one cycle", () => {
    const players = lobby(8);
    const plan = buildStartPlan(players.map((p) => p.card));

    const next = new Map(
      plan.assignments.map((a) => [toHex(a.player), toHex(a.target)]),
    );
    const start = plan.assignments[0];
    expect(start).toBeDefined();

    const visited = new Set<string>();
    let current = toHex(start?.player ?? new Uint8Array());
    for (let step = 0; step < players.length; step += 1) {
      expect(visited.has(current)).toBe(false);
      visited.add(current);
      current = next.get(current) ?? "";
    }

    // One lap visits everyone and comes back to the start: a single cycle, not two small ones.
    expect(visited.size).toBe(players.length);
    expect(current).toBe(toHex(start?.player ?? new Uint8Array()));
  });

  it("never makes anyone hunt themselves", () => {
    const plan = buildStartPlan(lobby(6).map((p) => p.card));
    plan.assignments.forEach((assignment) => {
      expect(toHex(assignment.target)).not.toBe(toHex(assignment.player));
    });
  });

  it("always publishes a full tree and a full set of envelopes", () => {
    [3, 5, 16].forEach((size) => {
      const plan = buildStartPlan(lobby(size).map((p) => p.card));
      // Padded regardless of headcount, so the tree does not leak how many are playing.
      expect(plan.leaves).toHaveLength(LEAF_SLOTS);
      expect(plan.envelopes).toHaveLength(LEAF_SLOTS);
    });
  });

  it("includes a real leaf for every player", () => {
    const plan = buildStartPlan(lobby(5).map((p) => p.card));
    const published = new Set(plan.leaves.map(toHex));

    plan.assignments.forEach((assignment) => {
      const leaf = pureCircuits.leafOf(assignment.player, {
        target: assignment.target,
        rand: assignment.rand,
      });
      expect(published.has(toHex(leaf))).toBe(true);
    });
  });

  it("gives every player exactly one envelope, holding their real target", () => {
    const players = lobby(6);
    const plan = buildStartPlan(players.map((p) => p.card));
    const assignmentsByPlayer = new Map(
      plan.assignments.map((a) => [toHex(a.player), a]),
    );

    players.forEach(({ identity }) => {
      const opened = findMyEnvelope(identity.encSecretKey, plan.envelopes);
      expect(opened).not.toBeNull();

      const expected = assignmentsByPlayer.get(toHex(identity.commitment));
      expect(expected).toBeDefined();
      expect(toHex(opened?.target ?? new Uint8Array())).toBe(
        toHex(expected?.target ?? new Uint8Array()),
      );
      expect(toHex(opened?.rand ?? new Uint8Array())).toBe(
        toHex(expected?.rand ?? new Uint8Array()),
      );
    });
  });

  it("tells a stranger nothing", () => {
    const plan = buildStartPlan(lobby(4).map((p) => p.card));
    const outsider = identityFrom(new Uint8Array(32).fill(9));
    expect(findMyEnvelope(outsider.encSecretKey, plan.envelopes)).toBeNull();
  });

  it("refuses a lobby that is too small or too large", () => {
    expect(() => buildStartPlan(lobby(2).map((p) => p.card))).toThrow(/three players/);
    expect(() => buildStartPlan(lobby(17).map((p) => p.card))).toThrow(/up to 16/);
  });

  it("does not put players in the order they joined", () => {
    const players = lobby(12);
    const cards = players.map((p) => p.card);
    const joinOrder = cards.map((card) => toHex(card.commitment)).join("");

    const sameOrder = Array.from({ length: 8 }, () => {
      const plan = buildStartPlan(cards);
      return plan.assignments.map((a) => toHex(a.player)).join("") === joinOrder;
    }).filter(Boolean);

    // With 12 players the chance of matching join order even once is negligible.
    expect(sameOrder).toHaveLength(0);
  });
});
