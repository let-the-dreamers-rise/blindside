// Sandbox mode runs the real compiled contract in the browser, through the same class the
// contract tests use. No wallet, no chain, no proving server: the rules are real, the proofs
// are not, and the UI says so.
// SPDX-License-Identifier: Apache-2.0

import { BlindsideGame, Player, hex } from "@blindside/contract";

export const CAST = ["You", "Riya", "Sam", "Nina", "Dev"] as const;

export type FeedEntry = {
  readonly id: number;
  readonly text: string;
  readonly detail?: string;
};

export type Snapshot = {
  readonly phase: "lobby" | "live" | "finished" | "other";
  readonly alive: number;
  readonly tags: number;
  readonly pot: bigint;
  readonly yourTarget: string | null;
  readonly youAreOut: boolean;
  readonly youWon: boolean;
  readonly claimed: boolean;
  readonly feed: readonly FeedEntry[];
  readonly nullifiers: readonly string[];
  readonly leaves: number;
  readonly commitments: readonly string[];
};

const PHASES = ["lobby", "live", "finished", "other", "other"] as const;

export class SandboxRunner {
  private readonly game = new BlindsideGame({ entryFee: 10n });
  private readonly players: readonly Player[];
  private readonly names = new Map<string, string>();
  private feed: readonly FeedEntry[] = [];
  private nextFeedId = 1;
  private claimed = false;

  constructor() {
    this.players = CAST.map((name) => new Player(name));
    this.players.forEach((player, index) => {
      this.names.set(player.key, CAST[index] ?? "Player");
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

  /** The code the player would show on their own screen. */
  yourCode(): string | null {
    if (!this.alive(this.you)) {
      return null;
    }
    const surrender = this.game.surrenderOf(this.you);
    return hex(surrender.tagToken);
  }

  tagYourTarget(): void {
    const target = this.targetOf(this.you);
    if (target === null) {
      return;
    }
    const before = this.nullifierCount();
    this.game.tag(this.you, target);
    this.say(
      "Someone was tagged.",
      `The chain gained ${this.nullifierCount() - before} spent notes and one new note. It did not learn who.`,
    );
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

  private nullifierCount(): number {
    return [...this.game.ledger().spent].length;
  }

  snapshot(): Snapshot {
    const state = this.game.ledger();
    const target = this.targetOf(this.you);
    const youAreOut = !this.alive(this.you);
    const phase = PHASES[Number(state.phase)] ?? "other";

    return {
      phase,
      alive: Number(state.aliveCount),
      tags: Number(state.tagCount),
      pot: state.pot,
      yourTarget: target === null ? null : this.nameOf(target.commitment),
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
