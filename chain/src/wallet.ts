// A wallet that can pay for a game, on a command line or in a browser tab.
// Adapted from midnightntwrk/example-counter (Apache-2.0), with the interactive parts removed.
//
// Opening a wallet and waiting for it to be usable are deliberately separate. A script can do
// both in one call, but a screen has to show the address before there is anything to wait for.
// SPDX-License-Identifier: Apache-2.0

import * as Rx from "rxjs";
import * as ledger from "@midnight-ntwrk/ledger-v8";
import { unshieldedToken } from "@midnight-ntwrk/ledger-v8";
import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import { DustWallet } from "@midnight-ntwrk/wallet-sdk-dust-wallet";
import { Roles } from "@midnight-ntwrk/wallet-sdk-hd";
import { ShieldedWallet } from "@midnight-ntwrk/wallet-sdk-shielded";
import {
  NoOpTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
  createKeystore,
  type UnshieldedKeystore,
} from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import { addressOf } from "./address.ts";
import type { ChainEndpoints } from "./networks.ts";
import { deriveKeys } from "./seed.ts";

const STATE_THROTTLE_MS = 2_000;

/** Fees are paid in DUST, which NIGHT generates once registered. This covers a whole game. */
const DUST_COST_PARAMETERS = {
  additionalFeeOverhead: 300_000_000_000_000n,
  feeBlocksMargin: 5,
};

export type WalletContext = {
  readonly wallet: WalletFacade;
  readonly shieldedSecretKeys: ledger.ZswapSecretKeys;
  readonly dustSecretKey: ledger.DustSecretKey;
  readonly unshieldedKeystore: UnshieldedKeystore;
  /** The Bech32m address a faucet pays. */
  readonly address: string;
};

export type WalletBalances = {
  readonly night: bigint;
  readonly dust: bigint;
  readonly synced: boolean;
};

const configurationFor = ({
  indexer,
  indexerWS,
  node,
  proofServer,
}: ChainEndpoints) => ({
  networkId: getNetworkId(),
  indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, "ws")),
  // Nothing here ever reads the wallet's transaction history: a run keeps the identifiers the
  // node hands back and writes its own record. Holding the history as well costs memory that
  // grows with the chain, which on a public network is the difference between a run finishing
  // and a run being killed part way through the sync.
  txHistoryStorage: new NoOpTransactionHistoryStorage(),
  costParameters: DUST_COST_PARAMETERS,
});

/** Starts a wallet and returns as soon as it is running. It may hold nothing yet. */
export const openWallet = async (
  endpoints: ChainEndpoints,
  seed: string,
): Promise<WalletContext> => {
  const keys = deriveKeys(seed);
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(
    keys[Roles.NightExternal],
    getNetworkId(),
  );

  const wallet = await WalletFacade.init({
    configuration: configurationFor(endpoints),
    shielded: (cfg) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (cfg) =>
      UnshieldedWallet(cfg).startWithPublicKey(
        PublicKey.fromKeyStore(unshieldedKeystore),
      ),
    dust: (cfg) =>
      DustWallet(cfg).startWithSecretKey(
        dustSecretKey,
        ledger.LedgerParameters.initialParameters().dust,
      ),
  });
  await wallet.start(shieldedSecretKeys, dustSecretKey);

  return {
    wallet,
    shieldedSecretKeys,
    dustSecretKey,
    unshieldedKeystore,
    address: addressOf(unshieldedKeystore),
  };
};

/** What the wallet currently holds, as a stream, for a screen to render as it settles. */
export const balances = (wallet: WalletFacade): Rx.Observable<WalletBalances> =>
  wallet.state().pipe(
    Rx.map((state) => ({
      night: state.unshielded.balances[unshieldedToken().raw] ?? 0n,
      dust: state.dust.balance(new Date()),
      synced: state.isSynced,
    })),
  );

export const waitForSync = (wallet: WalletFacade): Promise<unknown> =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(STATE_THROTTLE_MS),
      Rx.filter((state) => state.isSynced),
    ),
  );

export const waitForFunds = (wallet: WalletFacade): Promise<bigint> =>
  Rx.firstValueFrom(
    balances(wallet).pipe(
      Rx.throttleTime(STATE_THROTTLE_MS),
      Rx.filter((state) => state.synced && state.night > 0n),
      Rx.map((state) => state.night),
    ),
  );

/**
 * Registers the wallet's NIGHT to generate DUST, which is what actually pays fees.
 *
 * Returns whether it had to submit a transaction, so a screen can say why it is waiting.
 */
export const registerForDust = async (ctx: WalletContext): Promise<boolean> => {
  const state = await Rx.firstValueFrom(
    ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)),
  );
  if (state.dust.balance(new Date()) > 0n) {
    return false;
  }

  const unregistered = state.unshielded.availableCoins.filter(
    (coin: { meta?: { registeredForDustGeneration?: boolean } }) =>
      coin.meta?.registeredForDustGeneration !== true,
  );
  if (unregistered.length === 0) {
    return false;
  }

  const recipe = await ctx.wallet.registerNightUtxosForDustGeneration(
    unregistered,
    ctx.unshieldedKeystore.getPublicKey(),
    (payload: Uint8Array) => ctx.unshieldedKeystore.signData(payload),
  );
  await ctx.wallet.submitTransaction(await ctx.wallet.finalizeRecipe(recipe));
  return true;
};

export const waitForDust = (wallet: WalletFacade): Promise<bigint> =>
  Rx.firstValueFrom(
    balances(wallet).pipe(
      Rx.throttleTime(STATE_THROTTLE_MS),
      Rx.filter((state) => state.synced && state.dust > 0n),
      Rx.map((state) => state.dust),
    ),
  );

/** Opens a wallet and waits until it can actually pay for something. For scripted runs. */
export const buildWallet = async (
  endpoints: ChainEndpoints,
  seed: string,
): Promise<WalletContext> => {
  const ctx = await openWallet(endpoints, seed);
  await waitForSync(ctx.wallet);
  await waitForFunds(ctx.wallet);
  await registerForDust(ctx);
  await waitForDust(ctx.wallet);
  return ctx;
};
