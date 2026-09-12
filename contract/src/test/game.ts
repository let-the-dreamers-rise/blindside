// Test harness: one ledger, many identities.
// SPDX-License-Identifier: Apache-2.0
//
// A Blindside identity is a commitment, not a wallet, so a single simulated chain can run a
// whole game. The same trick is what makes hot-seat mode work in the app.

import { createHash } from "node:crypto";
import {
  type CircuitContext,
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Edge,
  type Ledger,
  type Surrender,
  ledger,
  pureCircuits,
} from "../managed/blindside/contract/index.js";
import {
  type BlindsidePrivateState,
  blankPrivateState,
  witnesses,
} from "../witnesses.js";

/** Deterministic 32 bytes, so a failing test can always be replayed. */
export const bytes32 = (seed: string): Uint8Array =>
  new Uint8Array(createHash("sha256").update(seed).digest());

export const hex = (b: Uint8Array): string => Buffer.from(b).toString("hex");

export const HOST_SK = bytes32("host:secret");

export class Player {
  readonly sk: Uint8Array;
  readonly tagToken: Uint8Array;
  readonly commitment: Uint8Array;
  readonly payout: Uint8Array;

  constructor(readonly name: string) {
    this.sk = bytes32(`player:${name}`);
    this.tagToken = pureCircuits.tagTokenOf(this.sk);
    this.commitment = pureCircuits.playerOf(this.tagToken);
    this.payout = bytes32(`payout:${name}`);
  }

  get key(): string {
    return hex(this.commitment);
  }
}

export type GameOptions = {
  readonly entryFee?: bigint;
  readonly cap?: bigint;
  readonly deadline?: bigint;
  readonly startTime?: number;
};

const LEAF_SLOTS = 16;

/**
 * Drives the contract the way the real clients do: a private state is assembled for the identity
 * taking the action, the circuit runs, and the harness keeps its own view of who holds which note
 * so tests can express "A tags B" instead of shuffling byte arrays.
 */
export class BlindsideGame {
  private readonly contract: Contract<BlindsidePrivateState>;
  private readonly address = sampleContractAddress();
  private context: CircuitContext<BlindsidePrivateState>;
  private notes: ReadonlyMap<string, Edge> = new Map();
  private tagSeq = 0;
  private time: number;

  readonly hostSk = HOST_SK;
  readonly entryFee: bigint;
  readonly deadline: bigint;

  constructor(options: GameOptions = {}) {
    this.entryFee = options.entryFee ?? 10n;
    this.deadline = options.deadline ?? 1_000_000n;
    this.time = options.startTime ?? 1_000;
    this.contract = new Contract<BlindsidePrivateState>(witnesses);

    const hostCommit = pureCircuits.hostCommitmentOf(this.hostSk);
    const { currentPrivateState, currentContractState, currentZswapLocalState } =
      this.contract.initialState(
        createConstructorContext(blankPrivateState(), "0".repeat(64)),
        this.entryFee,
        options.cap ?? BigInt(LEAF_SLOTS),
        hostCommit,
        this.deadline,
      );

    this.context = createCircuitContext(
      this.address,
      currentZswapLocalState,
      currentContractState,
      currentPrivateState,
      undefined,
      undefined,
      this.time,
    );
  }

  ledger(): Ledger {
    return ledger(this.context.currentQueryContext.state);
  }

  noteOf(player: Player): Edge | undefined {
    return this.notes.get(player.key);
  }

  /** Move the simulated clock. Used by the deadline and refund tests. */
  setTime(seconds: number): void {
    this.time = seconds;
    this.context = createCircuitContext(
      this.address,
      this.context.currentZswapLocalState,
      this.context.currentQueryContext.state,
      this.context.currentPrivateState,
      undefined,
      undefined,
      seconds,
    );
  }

  private run(
    privateState: BlindsidePrivateState,
    call: (context: CircuitContext<BlindsidePrivateState>) => {
      context: CircuitContext<BlindsidePrivateState>;
    },
  ): void {
    const before = { ...this.context, currentPrivateState: privateState };
    this.context = call(before).context;
  }

  join(player: Player): void {
    this.run(blankPrivateState(), (context) =>
      this.contract.impureCircuits.join(
        context,
        player.commitment,
        player.payout,
      ),
    );
  }

  /**
   * Builds one cycle over the given order, pads the tree to 16 leaves so the number of real
   * players is not readable from it, and starts the game. This is exactly what the host client
   * does, minus the encryption of each target envelope.
   */
  start(order: readonly Player[]): void {
    this.startAs(order, this.hostSk);
  }

  /** Same as start(), with an explicit host secret, so tests can try to impersonate the host. */
  startAs(order: readonly Player[], hostSk: Uint8Array): void {
    const notes = new Map<string, Edge>();
    const leaves: Uint8Array[] = [];

    order.forEach((player, index) => {
      const target = order[(index + 1) % order.length];
      if (target === undefined) {
        throw new Error("cycle order is empty");
      }
      const edge: Edge = {
        target: target.commitment,
        rand: bytes32(`edge:${player.name}:${index}`),
      };
      notes.set(player.key, edge);
      leaves.push(pureCircuits.leafOf(player.commitment, edge));
    });

    while (leaves.length < LEAF_SLOTS) {
      leaves.push(bytes32(`padding:${leaves.length}`));
    }

    this.run(withHost(hostSk), (context) =>
      this.contract.impureCircuits.startGame(context, leaves),
    );
    this.notes = notes; // only once the call succeeded
  }

  /** The code a victim shows when they are tagged. */
  surrenderOf(victim: Player): Surrender {
    const edge = this.notes.get(victim.key);
    if (edge === undefined) {
      throw new Error(`${victim.name} has no note to surrender`);
    }
    return { tagToken: victim.tagToken, target: edge.target, rand: edge.rand };
  }

  tag(hunter: Player, victim: Player, code?: Surrender): void {
    const mine = this.requireNote(hunter);
    const scanned = code ?? this.surrenderOf(victim);
    const nextRand = bytes32(`fresh:${hunter.name}:${this.tagSeq}`);
    this.tagSeq += 1;

    this.run(
      {
        ...blankPrivateState(),
        sk: hunter.sk,
        edge: mine,
        scanned,
        nextRand,
      },
      (context) => this.contract.impureCircuits.tag(context),
    );

    const inherited: Edge = { target: scanned.target, rand: nextRand };
    const next = new Map(this.notes);
    next.delete(victim.key);
    next.set(hunter.key, inherited);
    this.notes = next;
  }

  claimVictory(winner: Player): void {
    this.run(
      { ...blankPrivateState(), sk: winner.sk, edge: this.requireNote(winner) },
      (context) => this.contract.impureCircuits.claimVictory(context),
    );
  }

  resign(player: Player): void {
    this.run(
      { ...blankPrivateState(), sk: player.sk, edge: this.requireNote(player) },
      (context) => this.contract.impureCircuits.resign(context),
    );
  }

  openRefunds(): void {
    this.run(blankPrivateState(), (context) =>
      this.contract.impureCircuits.openRefunds(context),
    );
  }

  cancel(): void {
    this.cancelAs(this.hostSk);
  }

  cancelAs(hostSk: Uint8Array): void {
    this.run(withHost(hostSk), (context) =>
      this.contract.impureCircuits.cancel(context),
    );
  }

  refund(player: Player): void {
    this.run({ ...blankPrivateState(), sk: player.sk }, (context) =>
      this.contract.impureCircuits.refund(context),
    );
  }

  private requireNote(player: Player): Edge {
    const edge = this.notes.get(player.key);
    if (edge === undefined) {
      throw new Error(`${player.name} is out of the game`);
    }
    return edge;
  }
}

const withHost = (hostSk: Uint8Array): BlindsidePrivateState => ({
  ...blankPrivateState(),
  hostSk,
});
