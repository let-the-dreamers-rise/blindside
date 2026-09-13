// A whole game on a real Midnight chain: deploy, four joins, a start, three tags and a payout,
// every step with a real proof. Run against the local standalone stack.
// SPDX-License-Identifier: Apache-2.0

import { randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
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
  buildStartPlan,
  decodeTagCode,
  encodeTagCode,
  findMyEnvelope,
  newIdentity,
  toHex,
  type Identity,
} from "@blindside/core";
import { StandaloneConfig, contractConfig } from "./config.ts";
import { PRIVATE_STATE_ID, configureProviders } from "./providers.ts";
import {
  GENESIS_MINT_WALLET_SEED,
  type WalletContext,
  buildWallet,
  unshieldedAddressBytes,
} from "./wallet.ts";

const ENTRY_FEE = 10n;
const PLAYER_COUNT = 4;
const NAMES = ["Alex", "Bo", "Cam", "Dee"];

type Step = {
  readonly label: string;
  readonly seconds: number;
  readonly txId?: string;
  readonly blockHeight?: number;
};
const steps: Step[] = [];

/** Pulls the transaction identifiers out of whatever a call or a deploy hands back. */
const receiptOf = (result: unknown): Pick<Step, "txId" | "blockHeight"> => {
  const data =
    (result as { public?: { txId?: string; blockHeight?: number } })?.public ??
    (result as { deployTxData?: { public?: { txId?: string; blockHeight?: number } } })
      ?.deployTxData?.public;
  return { txId: data?.txId, blockHeight: data?.blockHeight };
};

const timed = async <T>(label: string, run: () => Promise<T>): Promise<T> => {
  const started = performance.now();
  const result = await run();
  const seconds = (performance.now() - started) / 1000;
  const receipt = receiptOf(result);
  steps.push({ label, seconds, ...receipt });
  const tx = receipt.txId === undefined ? "" : `  tx ${receipt.txId.slice(0, 16)}...`;
  console.log(`  ${label.padEnd(28)} ${seconds.toFixed(1)}s${tx}`);
  return result;
};

type Note = {
  readonly target: Uint8Array;
  readonly rand: Uint8Array;
  readonly targetName: string;
};

const main = async (): Promise<void> => {
  const config = new StandaloneConfig();

  console.log("\nBlindside: full game on a local Midnight chain\n");

  const ctx = await timed("wallet ready", () =>
    buildWallet(config, GENESIS_MINT_WALLET_SEED),
  );
  const providers = await configureProviders(ctx, config);
  const payout = payoutBytes(ctx);

  const players: readonly Identity[] = Array.from(
    { length: PLAYER_COUNT },
    () => newIdentity(),
  );
  const hostSecret = new Uint8Array(randomBytes(32));
  const hostCommit = pureCircuits.hostCommitmentOf(hostSecret);
  const endsAt = BigInt(Math.floor(Date.now() / 1000) + 3600);

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
      args: [ENTRY_FEE, BigInt(16), hostCommit, endsAt],
    }),
  );
  const address = game.deployTxData.public.contractAddress;
  console.log(`\n  contract ${address}\n`);

  // Private state is stored per contract, so the store has to be pointed at this game before
  // any identity can be swapped in.
  providers.privateStateProvider.setContractAddress(address);

  for (const [index, player] of players.entries()) {
    await setPrivateState({ sk: player.secret });
    await timed(`join ${NAMES[index] ?? index}`, () =>
      game.callTx.join(player.commitment, payout),
    );
  }

  const plan = buildStartPlan(
    players.map((player, index) => ({
      commitment: player.commitment,
      encPublicKey: player.encPublicKey,
      name: NAMES[index] ?? `Player ${index}`,
    })),
  );

  await setPrivateState({ hostSk: hostSecret });
  await waitForLedger(
    "everyone is in",
    providers,
    address,
    (current) => Number(current.playerCount) === PLAYER_COUNT,
  );
  await timed("start game", () => game.callTx.startGame([...plan.leaves]));

  // Each player opens the envelopes exactly as the app does, and keeps the one that is theirs.
  const notes = new Map<string, Note>();
  for (const player of players) {
    const mine = findMyEnvelope(player.encSecretKey, plan.envelopes);
    if (mine === null) {
      throw new Error("a player could not open any envelope");
    }
    notes.set(toHex(player.commitment), mine);
  }
  console.log(`\n  every player opened exactly one envelope\n`);

  const byCommitment = new Map(
    players.map((player) => [toHex(player.commitment), player]),
  );

  let hunter = players[0];
  if (hunter === undefined) {
    throw new Error("no players");
  }

  for (let round = 1; round < PLAYER_COUNT; round += 1) {
    const mine = notes.get(toHex(hunter.commitment));
    if (mine === undefined) {
      throw new Error("hunter has no note");
    }
    const victim = byCommitment.get(toHex(mine.target));
    const victimNote = notes.get(toHex(mine.target));
    if (victim === undefined || victimNote === undefined) {
      throw new Error("victim is not in the game");
    }

    // The victim shows a QR; the hunter scans it. Same encoding the app uses.
    const scanned = decodeTagCode(
      encodeTagCode({
        game: address,
        tagToken: victim.tagToken,
        target: victimNote.target,
        rand: victimNote.rand,
        targetName: victimNote.targetName,
      }),
      address,
    );

    const nextRand = new Uint8Array(randomBytes(32));
    await setPrivateState({
      sk: hunter.secret,
      edge: { target: mine.target, rand: mine.rand },
      scanned: {
        tagToken: scanned.tagToken,
        target: scanned.target,
        rand: scanned.rand,
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

    notes.delete(toHex(victim.commitment));
    notes.set(toHex(hunter.commitment), {
      target: scanned.target,
      rand: nextRand,
      targetName: scanned.targetName,
    });
  }

  const winnerNote = notes.get(toHex(hunter.commitment));
  if (winnerNote === undefined) {
    throw new Error("winner has no note");
  }
  await setPrivateState({
    sk: hunter.secret,
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

  const evidence = {
    network: "standalone",
    contractAddress: address,
    entryFee: ENTRY_FEE.toString(),
    players: PLAYER_COUNT,
    finishedPhase: Number(finalLedger.phase),
    potAfterPayout: finalLedger.pot.toString(),
    tagCount: finalLedger.tagCount.toString(),
    steps: steps.map((step) => ({
      ...step,
      seconds: Number(step.seconds.toFixed(2)),
    })),
    recordedAt: new Date().toISOString(),
  };
  const outDir = path.resolve(process.cwd(), "..", "deploy");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, "local-run.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
  console.log(`  evidence written to deploy/local-run.json\n`);

  process.exit(0);
};

type Providers = Awaited<ReturnType<typeof configureProviders>>;
type Ledger = ReturnType<typeof readLedger>;

const SYNC_POLL_MS = 2_000;
const SYNC_TIMEOUT_MS = 120_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

/** The payout address bound at join, as the 32 bytes the contract stores. */
const payoutBytes = (ctx: WalletContext): Uint8Array => {
  const bytes = unshieldedAddressBytes(ctx.unshieldedKeystore);
  if (bytes.length !== 32) {
    throw new Error(
      `expected a 32 byte payout address, got ${bytes.length}`,
    );
  }
  return bytes;
};

await main();
