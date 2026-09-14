// Sandbox mode runs the real compiled contract in the browser, through the same class the
// contract tests use. No wallet, no chain, no proving server: the rules are real, the proofs
// are not, and the UI says so.
// SPDX-License-Identifier: Apache-2.0

import { BlindsideGame, Player, hex } from "@blindside/contract";
import { readWordCode, wordCodeText, wordsFrom } from "@blindside/core";

export const CAST = ["You", "Riya", "Sam", "Nina", "Dev"] as const;

export type FeedEntry = {
  readonly id: number;
  readonly text: string;
  readonly detail?: string;
};

export type Phase = "lobby" | "live" | "finished" | "timedOut" | "cancelled";

export type Snapshot = {
  readonly phase: Phase;
  readonly alive: number;
  readonly tags: number;
  readonly pot: bigint;
  readonly yourTarget: string | null;
  /** The five words this player would say if somebody tagged them. */
  readonly yourWords: readonly string[] | null;
  /** What the target would say. A real game only ever hears this out loud. */
  readonly theirWords: readonly string[] | null;
  readonly youAreOut: boolean;
  readonly youWon: boolean;
  readonly claimed: boolean;
  readonly feed: readonly FeedEntry[];
  readonly nullifiers: readonly string[];
  readonly leaves: number;
  readonly commitments: readonly string[];
  readonly deadlinePassed: boolean;
  readonly refundsOpen: boolean;
  readonly youResigned: boolean;
  readonly refunded: number;
  readonly deadDrops: number;
};

const PHASES = ["lobby", "live", "finished", "timedOut", "cancelled"] as const;

/** The sandbox clock starts at 1000 and the game's deadline is 1,000,000. */
const AFTER_THE_DEADLINE = 1_000_001;

export class SandboxRunner {
  private readonly game = new BlindsideGame({ entryFee: 10n });
  private readonly players: readonly Player[];
  private readonly names = new Map<string, string>();
  private feed: readonly FeedEntry[] = [];
  private nextFeedId = 1;
  private claimed = false;
  private deadlinePassed = false;
  private resigned = false;
  private refunded = new Set<string>();

  /** The first name in the cast is always the person at the keyboard. */
  constructor(cast: readonly string[] = CAST) {
    this.players = cast.map((name) => new Player(name));
    this.players.forEach((player, index) => {
      this.names.set(player.key, cast[index] ?? "Player");
    });

    this.players.forEach((player) => this.game.join(player));
    this.game.start(this.players);
    this.say(`${this.players.length} players joined. The game is live.`);
  }

  private get you(): Player {
    const you = this.players[0];
    if (you === undefined) {
      throw new Error("sandbox has no players");
    }
    return you;
  }

  private say(text: string, detail?: string): void {
    const entry: FeedEntry =
      detail === undefined
        ? { id: this.nextFeedId, text }
        : { id: this.nextFeedId, text, detail };
    this.nextFeedId += 1;
    this.feed = [entry, ...this.feed].slice(0, 30);
  }

  private nameOf(commitment: Uint8Array): string {
    return this.names.get(hex(commitment)) ?? "someone";
  }

  private alive(player: Player): boolean {
    return this.game.noteOf(player) !== undefined;
  }

  targetOf(player: Player): Player | null {
    const note = this.game.noteOf(player);
    if (note === undefined) {
      return null;
    }
    return (
      this.players.find((candidate) => hex(candidate.commitment) === hex(note.target)) ??
      null
    );
  }

  /**
   * Why these words would not tag anybody, or null if they would.
   *
   * A real game learns this the same way: the words either open something in the published
   * bundle or they do not, and no name is ever compared against a list.
   */
  wouldRefuse(spoken: string): string | null {
    const target = this.targetOf(this.you);
    if (target === null) {
      return "You are not hunting anybody.";
    }
    const heard = readWordCode(spoken);
    if (heard === null) {
      return "That is not five words from the list.";
    }
    if (wordCodeText(heard) !== wordCodeText(wordsFrom(target.sk))) {
      return "Those words belong to somebody who is not your target.";
    }
    return null;
  }

  /**
   * Tags the player's target, but only if the words typed in are the ones that target would
   * have said. This is the whole handover: in a real game nothing else passes between the two
   * phones, which is why a tag works down a phone line as well as it does in a corridor.
   *
   * Returns a reason it did not happen, or null when it did.
   */
  tagYourTarget(spoken: string): string | null {
    const refusal = this.wouldRefuse(spoken);
    const target = this.targetOf(this.you);
    if (refusal !== null || target === null) {
      return refusal ?? "You are not hunting anybody.";
    }

    const before = this.nullifierCount();
    this.game.tag(this.you, target);
    this.say(
      "Someone was tagged.",
      `The chain gained ${this.nullifierCount() - before} spent notes and one new note. It did not learn who.`,
    );
    return null;
  }

  /** One bot tags its target, so the game moves while you are not looking. */
  botMove(): boolean {
    const hunter = this.players
      .slice(1)
      .find((player) => this.alive(player) && this.targetOf(player) !== null &&
        this.targetOf(player) !== this.you);
    const victim = hunter === undefined ? null : this.targetOf(hunter);
    if (hunter === undefined || victim === null || !this.alive(victim)) {
      return false;
    }
    this.game.tag(hunter, victim);
    this.say("Someone was tagged.", "Two notes spent, one created. No names on chain.");
    return true;
  }

  claim(): void {
    this.game.claimVictory(this.you);
    this.claimed = true;
    this.say("The pot was claimed by the last player standing.");
  }

  // ------------------------------------------------------------ the hunt
  //
  // The pixel game needs to know the whole map so its bots can hunt, which is exactly what the
  // screen must never be told. These answer by index, never by name, and the screen only ever
  // learns the name of its own target.

  nameAt(index: number): string {
    const player = this.players[index];
    return player === undefined ? "someone" : this.nameOf(player.commitment);
  }

  /** Who each player is hunting, as indexes into the cast. Null once they are out. */
  edges(): readonly (number | null)[] {
    return this.players.map((player) => {
      const target = this.targetOf(player);
      return target === null ? null : this.players.indexOf(target);
    });
  }

  aliveFlags(): readonly boolean[] {
    return this.players.map((player) => this.alive(player));
  }

  /** The words this player would say if tagged. The hunt shows them only at the moment. */
  wordsAt(index: number): readonly string[] | null {
    const player = this.players[index];
    return player === undefined || !this.alive(player) ? null : [...wordsFrom(player.sk)];
  }

  /**
   * One player tags another, both by index. This is how a bot's tag, or your own hunter
   * catching you, reaches the real contract: the same circuit, the same refusals.
   */
  tagBetween(hunter: number, victim: number): void {
    const from = this.players[hunter];
    const to = this.players[victim];
    if (from === undefined || to === undefined || this.targetOf(from) !== to) {
      throw new Error("that is not a tag the contract would accept");
    }
    const before = this.nullifierCount();
    this.game.tag(from, to);
    this.say(
      "Someone was tagged.",
      `The chain gained ${this.nullifierCount() - before} spent notes and one new note. It did not learn who.`,
    );
  }

  /** The last player standing claims, whoever it is. A bot's win empties the pot too. */
  claimBy(index: number): void {
    const winner = this.players[index];
    if (winner === undefined) {
      throw new Error("no such player");
    }
    this.game.claimVictory(winner);
    this.claimed = true;
    this.say("The pot was claimed by the last player standing.");
  }

  // ------------------------------------------------------------ the ways out
  //
  // These are the paths that keep the pot from ever being trapped. They are here rather than
  // buried in a test because the promise on the front page is that the money can always leave,
  // and a promise you can press a button on is worth more than one you have to take on trust.

  /** You drop out. Your hunter can still finish you off, and nobody else can use the code. */
  quit(): void {
    this.game.resign(this.you);
    this.resigned = true;
    this.say(
      "You left a dead drop.",
      "Only the player hunting you holds a note that matches it, so only they can use it. It does reveal who you were hunting.",
    );
  }

  /** Nobody tags anyone again. The clock runs out. */
  letTheDeadlinePass(): void {
    this.game.setTime(AFTER_THE_DEADLINE);
    this.deadlinePassed = true;
    this.say(
      "The deadline passed.",
      "Anyone can now open refunds. Not the organizer, anyone.",
    );
  }

  openRefunds(): void {
    this.game.openRefunds();
    this.say(
      "Refunds are open.",
      "The game is over as a draw. Every player who joined can take their own entry fee back.",
    );
  }

  takeRefund(index = 0): void {
    const player = this.players[index];
    if (player === undefined || this.refunded.has(player.key)) {
      return;
    }
    this.game.refund(player);
    this.refunded = new Set([...this.refunded, player.key]);
    this.say(
      index === 0 ? "You took your refund." : "Someone took their refund.",
      `The pot is down to ${this.game.ledger().pot}. Tagged players get theirs back too, so refusing to surrender never wins anything.`,
    );
  }

  refundEveryone(): void {
    this.players.forEach((_, index) => this.takeRefund(index));
  }

  private nullifierCount(): number {
    return [...this.game.ledger().spent].length;
  }

  snapshot(): Snapshot {
    const state = this.game.ledger();
    const target = this.targetOf(this.you);
    const youAreOut = !this.alive(this.you);
    const phase = PHASES[Number(state.phase)] ?? "lobby";

    return {
      phase,
      deadlinePassed: this.deadlinePassed,
      refundsOpen: phase === "timedOut" || phase === "cancelled",
      youResigned: this.resigned,
      refunded: this.refunded.size,
      deadDrops: Number(state.deadDrops.size()),
      alive: Number(state.aliveCount),
      tags: Number(state.tagCount),
      pot: state.pot,
      yourTarget: target === null ? null : this.nameOf(target.commitment),
      yourWords: youAreOut ? null : [...wordsFrom(this.you.sk)],
      theirWords: target === null ? null : [...wordsFrom(target.sk)],
      youAreOut,
      youWon: phase === "finished" && !youAreOut,
      claimed: this.claimed,
      feed: this.feed,
      nullifiers: [...state.spent].map(hex),
      leaves: Number(state.edges.firstFree()),
      commitments: [...state.players].map(hex),
    };
  }
}
