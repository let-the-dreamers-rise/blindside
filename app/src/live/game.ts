// A whole game on a real Midnight chain, run from this tab.
//
// Same contract, same proofs and same handover as the command line runner; the only difference is
// that a person is driving it. Every method here is one transaction: a proof built against a
// local proof server, submitted to a node, and waited on.
// SPDX-License-Identifier: Apache-2.0

import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { deployContract } from "@midnight-ntwrk/midnight-js/contracts";
import {
  type BlindsidePrivateState,
  Contract,
  blankPrivateState,
  ledger as readLedger,
  pureCircuits,
  witnesses,
} from "@blindside/contract";
import {
  type BlindsideProviders,
  PRIVATE_STATE_ID,
  type WalletContext,
  payoutBytesOf,
} from "@blindside/chain";
import {
  type Assignment,
  type Identity,
  type GameKeys,
  buildStartPlan,
  decodeBundle,
  encodeBundle,
  joinCard,
  keysForGame,
  myAssignment,
  newIdentity,
  readWordCode,
  republish,
  surrenderFromWords,
  toHex,
} from "@blindside/core";

const MAX_PLAYERS = 16n;
const SYNC_POLL_MS = 2_000;
const SYNC_TIMEOUT_MS = 180_000;

export type Ledger = ReturnType<typeof readLedger>;

export type Seat = {
  readonly identity: Identity;
  readonly keys: GameKeys;
  readonly name: string;
};

export type GameSetup = {
  readonly entryFee: bigint;
  readonly minutes: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Where the compiled proving material lives. In a browser there is no disk, so this is a path
 * under the app's own origin, filled at build time by scripts/zk-assets.mjs.
 */
const ZK_ASSETS = "zk";

const compiled = CompiledContract.make("blindside", Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(ZK_ASSETS),
);

/**
 * A circuit is proven against the state the indexer last served, so a call made straight after
 * the one it depends on can be built on a state that does not contain it yet. On chain that looks
 * like a failed assertion inside the proof with nothing to say which one, so every dependent call
 * waits here first.
 */
const waitFor = async (
  providers: BlindsideProviders,
  address: string,
  predicate: (ledger: Ledger) => boolean,
): Promise<Ledger> => {
  const deadline = Date.now() + SYNC_TIMEOUT_MS;
  for (;;) {
    const state = await providers.publicDataProvider.queryContractState(address);
    const current = state === null ? null : readLedger(state.data);
    if (current !== null && predicate(current)) {
      return current;
    }
    if (Date.now() > deadline) {
      throw new Error("The chain never caught up. Is the indexer still running?");
    }
    await sleep(SYNC_POLL_MS);
  }
};

export class LiveGame {
  private seats: readonly Seat[] = [];
  private notes: ReadonlyMap<string, Assignment> = new Map();
  private out = new Set<string>();
  private bundleText = "";
  private generation = 0;

  private constructor(
    private readonly providers: BlindsideProviders,
    private readonly wallet: WalletContext,
    private readonly hostSecret: Uint8Array,
    readonly address: string,
    private readonly game: Awaited<ReturnType<typeof deployContract>>,
  ) {}

  /** Deploys a new game. The host secret is made here and never leaves this tab. */
  static async create(
    providers: BlindsideProviders,
    wallet: WalletContext,
    { entryFee, minutes }: GameSetup,
  ): Promise<LiveGame> {
    const hostSecret = crypto.getRandomValues(new Uint8Array(32));
    const endsAt = BigInt(Math.floor(Date.now() / 1000) + minutes * 60);

    const deployed = await deployContract(providers, {
      compiledContract: compiled,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: blankPrivateState(),
      args: [entryFee, MAX_PLAYERS, pureCircuits.hostCommitmentOf(hostSecret), endsAt],
    });
    const address = deployed.deployTxData.public.contractAddress;

    // Private state is kept per contract, so the store has to be pointed at this game before any
    // identity can be swapped in.
    providers.privateStateProvider.setContractAddress(address);

    return new LiveGame(providers, wallet, hostSecret, address, deployed);
  }

  /**
   * The compiled contract exposes its circuits through an index signature, so each one reads as
   * possibly missing. None of them are: the contract is compiled from source in this repo and CI
   * fails if it is not. Checking once here turns a type-level maybe into an error nobody will see.
   */
  private get calls() {
    const callTx = this.game.callTx;
    const { join, startGame, tag, claimVictory } = callTx;
    if (
      join === undefined ||
      startGame === undefined ||
      tag === undefined ||
      claimVictory === undefined
    ) {
      throw new Error("This build of the contract is missing a circuit");
    }
    return {
      join: join.bind(callTx),
      startGame: startGame.bind(callTx),
      tag: tag.bind(callTx),
      claimVictory: claimVictory.bind(callTx),
    };
  }

  private setPrivateState(state: Partial<BlindsidePrivateState>): Promise<unknown> {
    return this.providers.privateStateProvider.set(PRIVATE_STATE_ID, {
      ...blankPrivateState(),
      ...state,
    });
  }

  get bundle(): string {
    return this.bundleText;
  }

  get players(): readonly { readonly name: string; readonly out: boolean }[] {
    return this.seats.map((seat) => ({
      name: seat.name,
      out: this.out.has(toHex(seat.identity.commitment)),
    }));
  }

  /** The words a given player would say. Shown only because this tab is every player at once. */
  wordsOf(index: number): readonly string[] {
    return this.seats[index]?.identity.words ?? [];
  }

  state(): Promise<Ledger> {
    return waitFor(this.providers, this.address, () => true);
  }

  /** One player joins: one entry fee into the contract, one commitment published. */
  async join(name: string): Promise<void> {
    const identity = newIdentity();
    const seat: Seat = {
      identity,
      keys: keysForGame(identity.words, this.address),
      name,
    };

    await this.setPrivateState({ sk: identity.secret });
    await this.calls.join(
      identity.commitment,
      payoutBytesOf(this.wallet.unshieldedKeystore),
    );
    this.seats = [...this.seats, seat];
  }

  /** The organizer shuffles the cycle, publishes the tree, and publishes the bundle. */
  async start(): Promise<void> {
    const plan = buildStartPlan(
      this.seats.map((seat) => joinCard(seat.identity, seat.keys, seat.name)),
    );

    await this.setPrivateState({ hostSk: this.hostSecret });
    await waitFor(
      this.providers,
      this.address,
      (current) => Number(current.playerCount) === this.seats.length,
    );
    await this.calls.startGame([...plan.leaves]);

    this.bundleText = encodeBundle({ game: this.address, items: plan.items });
    this.notes = new Map(
      this.seats.map((seat) => {
        const mine = myAssignment(seat.keys, plan.items);
        if (mine === null) {
          throw new Error(`${seat.name} could not find a target in the bundle`);
        }
        return [toHex(seat.identity.commitment), mine];
      }),
    );
  }

  /**
   * A tag, from five words somebody said.
   *
   * Nothing here knows who is tagging: the words are tried against the published bundle, and
   * whoever they open is the player being surrendered. Their hunter is then whoever holds a note
   * pointing at them, which is exactly one person.
   */
  async tagFromWords(spoken: string): Promise<string> {
    const heard = readWordCode(spoken);
    if (heard === null) {
      throw new Error("That is not five words from the list.");
    }

    const items = decodeBundle(this.bundleText, this.address).items;
    const surrender = surrenderFromWords(heard, this.address, items);
    if (surrender === null) {
      throw new Error("Nothing in this game opens with those words.");
    }

    const victimKey = toHex(pureCircuits.playerOf(surrender.tagToken));
    const victim = this.seats.find(
      (seat) => toHex(seat.identity.commitment) === victimKey,
    );
    if (victim === undefined || this.out.has(victimKey)) {
      throw new Error("That player is already out.");
    }

    const hunter = this.seats.find((seat) => {
      const note = this.notes.get(toHex(seat.identity.commitment));
      return note !== undefined && toHex(note.target) === victimKey;
    });
    const mine = hunter && this.notes.get(toHex(hunter.identity.commitment));
    if (hunter === undefined || mine === undefined) {
      throw new Error("Nobody in this game is hunting them.");
    }

    const nextRand = crypto.getRandomValues(new Uint8Array(32));
    await this.setPrivateState({
      sk: hunter.identity.secret,
      edge: { target: mine.target, rand: mine.rand },
      scanned: {
        tagToken: surrender.tagToken,
        target: surrender.target,
        rand: surrender.rand,
      },
      nextRand,
    });
    await waitFor(
      this.providers,
      this.address,
      (current) => Number(current.tagCount) === this.generation,
    );
    await this.calls.tag();

    // The hunter inherited a target, so they seal a later note to their own words and add it to
    // the bundle. Whoever hunts them next will need that one, not the one they started with.
    this.generation += 1;
    const inherited: Assignment = {
      target: surrender.target,
      rand: nextRand,
      targetName: surrender.targetName,
      generation: this.generation,
    };
    this.bundleText = encodeBundle({
      game: this.address,
      items: [...items, republish(hunter.keys, inherited)],
    });

    const notes = new Map(this.notes);
    notes.delete(victimKey);
    notes.set(toHex(hunter.identity.commitment), inherited);
    this.notes = notes;
    this.out = new Set([...this.out, victimKey]);

    return victim.name;
  }

  /** The last player proves they are last, and the contract pays out. */
  async claim(): Promise<string> {
    const winner = this.seats.find(
      (seat) => !this.out.has(toHex(seat.identity.commitment)),
    );
    const note = winner && this.notes.get(toHex(winner.identity.commitment));
    if (winner === undefined || note === undefined) {
      throw new Error("Nobody is left to claim.");
    }

    await this.setPrivateState({
      sk: winner.identity.secret,
      edge: { target: note.target, rand: note.rand },
    });
    await waitFor(this.providers, this.address, (current) => Number(current.aliveCount) === 1);
    await this.calls.claimVictory();
    await waitFor(this.providers, this.address, (current) => current.pot === 0n);

    return winner.name;
  }
}
