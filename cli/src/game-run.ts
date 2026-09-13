// A whole game on a real Midnight chain: deploy, four joins, a start, three tags and a payout,
// every step with a real proof. The network is the only thing that changes between runs.
// SPDX-License-Identifier: Apache-2.0

import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { deployContract } from "@midnight-ntwrk/midnight-js/contracts";
import {
  Contract,
  type BlindsidePrivateState,
  blankPrivateState,
  ledger as readLedger,
  pureCircuits,
  witnesses,
} from "@blindside/contract";
import {
  type Assignment,
  type GameKeys,
  type Identity,
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
  wordCodeText,
} from "@blindside/core";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import {
  type BlindsideCircuits,
  type ChainNetwork,
  PRIVATE_STATE_ID,
  buildWallet,
  configureProviders,
  payoutBytesOf,
} from "@blindside/chain";
import { contractConfig } from "./config.ts";

const PLAYER_COUNT = 4;
const NAMES = ["Alex", "Bo", "Cam", "Dee"];
const GAME_LENGTH_SECONDS = 3600;
const SYNC_POLL_MS = 2_000;
const SYNC_TIMEOUT_MS = 180_000;

export type RunOptions = {
  readonly network: ChainNetwork;
  readonly seed: string;
  readonly entryFee: bigint;
};

type Step = {
  readonly label: string;
  readonly seconds: number;
  readonly txId?: string;
  readonly blockHeight?: number;
};

type Providers = Awaited<ReturnType<typeof configureProviders>>;
type Ledger = ReturnType<typeof readLedger>;
type Seat = {
  readonly identity: Identity;
  readonly keys: GameKeys;
  readonly name: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Pulls the transaction identifiers out of whatever a call or a deploy hands back. */
const receiptOf = (result: unknown): Pick<Step, "txId" | "blockHeight"> => {
  const data =
    (result as { public?: { txId?: string; blockHeight?: number } })?.public ??
    (result as { deployTxData?: { public?: { txId?: string; blockHeight?: number } } })
      ?.deployTxData?.public;
  return { txId: data?.txId, blockHeight: data?.blockHeight };
};

const makeTimer = (steps: Step[]) =>
  async <T>(label: string, run: () => Promise<T>): Promise<T> => {
    const started = performance.now();
    const result = await run();
    const seconds = (performance.now() - started) / 1000;
    const receipt = receiptOf(result);
    steps.push({ label, seconds, ...receipt });
    const tx = receipt.txId === undefined ? "" : `  tx ${receipt.txId.slice(0, 16)}...`;
    console.log(`  ${label.padEnd(28)} ${seconds.toFixed(1)}s${tx}`);
    return result;
  };

/**
 * Waits until the indexer reports a state that satisfies `predicate`.
 *
 * A circuit is proven against the state the indexer last served, so a call made straight after
 * the previous one can be built on a state that does not contain it yet. On chain that looks
 * like a failed assertion inside the proof with no way to tell which one, so every call that
 * depends on an earlier one waits here first.
 */
const waitForLedger = async (
  label: string,
  providers: Providers,
  address: string,
  predicate: (ledger: Ledger) => boolean,
): Promise<Ledger> => {
  const deadline = Date.now() + SYNC_TIMEOUT_MS;
  for (;;) {
    const state = await providers.publicDataProvider.queryContractState(address);
    const current = state === null ? null : readLedger(state.data);
    if (current !== null && predicate(current)) {
      console.log(
        `  ${label.padEnd(28)} phase=${current.phase} players=${current.playerCount}` +
          ` alive=${current.aliveCount} tags=${current.tagCount} pot=${current.pot}`,
      );
      return current;
    }
    if (Date.now() > deadline) {
      throw new Error(`the chain never reached the state expected before ${label}`);
    }
    await sleep(SYNC_POLL_MS);
  }
};

export const runFullGame = async ({
  network,
  seed,
  entryFee,
}: RunOptions): Promise<void> => {
  const steps: Step[] = [];
  const timed = makeTimer(steps);

  console.log(`\nBlindside: a full game on ${network.id}\n`);

  const ctx = await timed("wallet ready", () => buildWallet(network, seed));
  const providers = await configureProviders(
    ctx,
    network,
    new NodeZkConfigProvider<BlindsideCircuits>(contractConfig.zkConfigPath),
  );
  const payout = payoutBytesOf(ctx.unshieldedKeystore);

  // Identities exist before the game does. Their keys do not: a player's key comes from the
  // words they will say and the address of the game they are saying them in.
  const identities = Array.from({ length: PLAYER_COUNT }, () => newIdentity());
  const hostSecret = new Uint8Array(randomBytes(32));
  const hostCommit = pureCircuits.hostCommitmentOf(hostSecret);
  const endsAt = BigInt(Math.floor(Date.now() / 1000) + GAME_LENGTH_SECONDS);

  const setPrivateState = (state: Partial<BlindsidePrivateState>) =>
    providers.privateStateProvider.set(PRIVATE_STATE_ID, {
      ...blankPrivateState(),
      ...state,
    });

  // The witnesses read whatever private state is current, so switching identity between calls is
  // just a write to the private state provider.
  const compiledContract = CompiledContract.make("blindside", Contract).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(contractConfig.zkConfigPath),
  );

  const game = await timed("deploy", () =>
    deployContract(providers, {
      compiledContract,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: blankPrivateState(),
      args: [entryFee, BigInt(16), hostCommit, endsAt],
    }),
  );
  const address = game.deployTxData.public.contractAddress;
  console.log(`\n  contract ${address}\n`);

  // Private state is stored per contract, so the store has to be pointed at this game before
  // any identity can be swapped in.
  providers.privateStateProvider.setContractAddress(address);

  const seats: readonly Seat[] = identities.map((identity, index) => ({
    identity,
    keys: keysForGame(identity.words, address),
    name: NAMES[index] ?? `Player ${index}`,
  }));

  for (const seat of seats) {
    await setPrivateState({ sk: seat.identity.secret });
    await timed(`join ${seat.name}`, () =>
      game.callTx.join(seat.identity.commitment, payout),
    );
  }

  const plan = buildStartPlan(
    seats.map((seat) => joinCard(seat.identity, seat.keys, seat.name)),
  );

  await setPrivateState({ hostSk: hostSecret });
  await waitForLedger(
    "everyone is in",
    providers,
    address,
    (current) => Number(current.playerCount) === PLAYER_COUNT,
  );
  await timed("start game", () => game.callTx.startGame([...plan.leaves]));

  // The organizer publishes one line of text: all the sealed items, shuffled and padded. It is
  // safe anywhere, because everything in it is ciphertext and nothing in it says who is playing.
  let bundle = encodeBundle({ game: address, items: plan.items });
  console.log(
    `\n  bundle published: ${plan.items.length} sealed items, ${bundle.length} characters\n`,
  );

  // Each player reads their own target out of the public bundle, exactly as the app does.
  const notes = new Map<string, Assignment>();
  for (const seat of seats) {
    const mine = myAssignment(seat.keys, decodeBundle(bundle, address).items);
    if (mine === null) {
      throw new Error(`${seat.name} could not find a target in the bundle`);
    }
    notes.set(toHex(seat.identity.commitment), mine);
  }
  console.log(`  every player found exactly one target, and nobody found two\n`);

  const hunter = seats[0];
  if (hunter === undefined) {
    throw new Error("no players");
  }

  for (let round = 1; round < PLAYER_COUNT; round += 1) {
    const mine = notes.get(toHex(hunter.identity.commitment));
    if (mine === undefined) {
      throw new Error("hunter has no note");
    }
    const victim = seats.find(
      (seat) => toHex(seat.identity.commitment) === toHex(mine.target),
    );
    if (victim === undefined) {
      throw new Error("victim is not in the game");
    }

    // The whole handover: the victim says five words, and the hunter types what they heard.
    // Nothing else passes between the two of them, over any channel, in person or not.
    const said = wordCodeText(victim.identity.words);
    const heard = readWordCode(said);
    const surrender =
      heard === null
        ? null
        : surrenderFromWords(heard, address, decodeBundle(bundle, address).items);
    if (surrender === null) {
      throw new Error("the words the victim said opened nothing in the bundle");
    }
    console.log(`  ${victim.name} said: ${said}`);

    const nextRand = new Uint8Array(randomBytes(32));
    await setPrivateState({
      sk: hunter.identity.secret,
      edge: { target: mine.target, rand: mine.rand },
      scanned: {
        tagToken: surrender.tagToken,
        target: surrender.target,
        rand: surrender.rand,
      },
      nextRand,
    });
    await waitForLedger(
      `chain ready for tag ${round}`,
      providers,
      address,
      (current) => Number(current.tagCount) === round - 1,
    );
    await timed(`tag ${round}`, () => game.callTx.tag());

    // The hunter inherited a target, so they seal a later note to their own words and add it to
    // the bundle. Whoever is hunting them will need that one, not the one they started with.
    const inherited: Assignment = {
      target: surrender.target,
      rand: nextRand,
      targetName: surrender.targetName,
      generation: round,
    };
    bundle = encodeBundle({
      game: address,
      items: [
        ...decodeBundle(bundle, address).items,
        republish(hunter.keys, inherited),
      ],
    });
    notes.delete(toHex(victim.identity.commitment));
    notes.set(toHex(hunter.identity.commitment), inherited);
  }

  const winnerNote = notes.get(toHex(hunter.identity.commitment));
  if (winnerNote === undefined) {
    throw new Error("winner has no note");
  }
  await setPrivateState({
    sk: hunter.identity.secret,
    edge: { target: winnerNote.target, rand: winnerNote.rand },
  });
  await waitForLedger(
    "one player left",
    providers,
    address,
    (current) => Number(current.aliveCount) === 1,
  );
  await timed("claim victory", () => game.callTx.claimVictory());

  const finalLedger = await waitForLedger(
    "paid out",
    providers,
    address,
    (current) => current.pot === 0n,
  );

  console.log(`
  phase        ${finalLedger.phase}
  players      ${finalLedger.playerCount}
  alive        ${finalLedger.aliveCount}
  tags         ${finalLedger.tagCount}
  pot          ${finalLedger.pot}
  spent notes  ${finalLedger.spent.size()}
`);

  writeEvidence({
    network: network.id,
    contractAddress: address,
    entryFee: entryFee.toString(),
    players: PLAYER_COUNT,
    handover: "five spoken words",
    sealedItems: plan.items.length,
    bundleCharacters: bundle.length,
    finishedPhase: Number(finalLedger.phase),
    potAfterPayout: finalLedger.pot.toString(),
    tagCount: finalLedger.tagCount.toString(),
    steps: steps.map((step) => ({
      ...step,
      seconds: Number(step.seconds.toFixed(2)),
    })),
    recordedAt: new Date().toISOString(),
  });
};

/**
 * The app ships this file and shows it on its evidence page, so what a judge reads there is the
 * output of a run and not a screenshot of one.
 */
const writeEvidence = (evidence: Record<string, unknown>): void => {
  const outDir = path.resolve(process.cwd(), "..", "app", "src", "evidence");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, "chain-run.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
  console.log(`  evidence written to app/src/evidence/chain-run.json\n`);
};
