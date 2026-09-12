// Private state for Blindside, and the witness functions that read it.
// SPDX-License-Identifier: Apache-2.0
//
// Everything in here stays on the player's own device. None of it is ever sent to a server, and
// none of it reaches the chain except through a proof.

import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";
import type {
  Edge,
  Ledger,
  Surrender,
  Witnesses,
} from "./managed/blindside/contract/index.js";

export const BYTES_32 = 32;

const zero32 = (): Uint8Array => new Uint8Array(BYTES_32);

/**
 * The private half of a player's game.
 *
 * `hostSk` is only non-zero on the organizer's device. `edge` is the opening of the note that
 * says who this player is hunting; it is replaced after every successful tag. `scanned` holds
 * the code most recently taken from a victim, and `nextRand` the randomness for the note the
 * player is about to inherit.
 */
export type BlindsidePrivateState = {
  readonly hostSk: Uint8Array;
  readonly sk: Uint8Array;
  readonly edge: Edge;
  readonly nextRand: Uint8Array;
  readonly scanned: Surrender;
};

export const blankPrivateState = (): BlindsidePrivateState => ({
  hostSk: zero32(),
  sk: zero32(),
  edge: { target: zero32(), rand: zero32() },
  nextRand: zero32(),
  scanned: { tagToken: zero32(), target: zero32(), rand: zero32() },
});

/** Every update returns a new state; private state is never mutated in place. */
export const withSecret = (
  state: BlindsidePrivateState,
  sk: Uint8Array,
): BlindsidePrivateState => ({ ...state, sk });

export const withEdge = (
  state: BlindsidePrivateState,
  edge: Edge,
): BlindsidePrivateState => ({ ...state, edge });

export const withScanned = (
  state: BlindsidePrivateState,
  scanned: Surrender,
  nextRand: Uint8Array,
): BlindsidePrivateState => ({ ...state, scanned, nextRand });

export const withHostSecret = (
  state: BlindsidePrivateState,
  hostSk: Uint8Array,
): BlindsidePrivateState => ({ ...state, hostSk });

/**
 * Error thrown when the note a player is trying to spend is not in the tree. In the app this is
 * the "your code is out of date" case: the victim tagged someone else after showing their code.
 */
export class UnknownEdgeError extends Error {
  constructor() {
    super("Code out of date: that note is not in the game tree");
    this.name = "UnknownEdgeError";
  }
}

export const witnesses: Witnesses<BlindsidePrivateState> = {
  hostSecret: ({
    privateState,
  }: WitnessContext<Ledger, BlindsidePrivateState>): [
    BlindsidePrivateState,
    Uint8Array,
  ] => [privateState, privateState.hostSk],

  playerSecret: ({
    privateState,
  }: WitnessContext<Ledger, BlindsidePrivateState>): [
    BlindsidePrivateState,
    Uint8Array,
  ] => [privateState, privateState.sk],

  myEdge: ({
    privateState,
  }: WitnessContext<Ledger, BlindsidePrivateState>): [
    BlindsidePrivateState,
    Edge,
  ] => [privateState, privateState.edge],

  edgePath: (
    { ledger, privateState }: WitnessContext<Ledger, BlindsidePrivateState>,
    leaf: Uint8Array,
  ) => {
    const path = ledger.edges.findPathForLeaf(leaf);
    if (path === undefined) {
      throw new UnknownEdgeError();
    }
    return [privateState, path];
  },

  surrendered: ({
    privateState,
  }: WitnessContext<Ledger, BlindsidePrivateState>): [
    BlindsidePrivateState,
    Surrender,
  ] => [privateState, privateState.scanned],

  freshRand: ({
    privateState,
  }: WitnessContext<Ledger, BlindsidePrivateState>): [
    BlindsidePrivateState,
    Uint8Array,
  ] => [privateState, privateState.nextRand],
};
