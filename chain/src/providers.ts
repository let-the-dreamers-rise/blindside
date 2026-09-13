// Wiring between the wallet SDK and midnight-js. Adapted from midnightntwrk/example-counter
// (Apache-2.0).
// SPDX-License-Identifier: Apache-2.0

import * as Rx from "rxjs";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import type { ZKConfigProvider } from "@midnight-ntwrk/midnight-js-types";
import type {
  MidnightProvider,
  WalletProvider,
} from "@midnight-ntwrk/midnight-js/types";
import type { ChainEndpoints } from "./networks.ts";
import { signTransactionIntents } from "./signing.ts";
import type { WalletContext } from "./wallet.ts";

export type BlindsideCircuits =
  | "join"
  | "startGame"
  | "tag"
  | "claimVictory"
  | "resign"
  | "openRefunds"
  | "cancel"
  | "refund";

export const PRIVATE_STATE_ID = "blindsidePrivateState";
export const PRIVATE_STATE_STORE = "blindside-private-state";

export const createWalletAndMidnightProvider = async (
  ctx: WalletContext,
): Promise<WalletProvider & MidnightProvider> => {
  const state = await Rx.firstValueFrom(
    ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)),
  );
  return {
    getCoinPublicKey() {
      return state.shielded.coinPublicKey.toHexString();
    },
    getEncryptionPublicKey() {
      return state.shielded.encryptionPublicKey.toHexString();
    },
    async balanceTx(tx, ttl?) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(
        tx,
        {
          shieldedSecretKeys: ctx.shieldedSecretKeys,
          dustSecretKey: ctx.dustSecretKey,
        },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      const signFn = (payload: Uint8Array) =>
        ctx.unshieldedKeystore.signData(payload);
      signTransactionIntents(recipe.baseTransaction, signFn, "proof");
      if (recipe.balancingTransaction) {
        signTransactionIntents(recipe.balancingTransaction, signFn, "pre-proof");
      }
      return ctx.wallet.finalizeRecipe(recipe);
    },
    submitTx(tx) {
      return ctx.wallet.submitTransaction(tx);
    },
  };
};

/**
 * The provider set midnight-js needs, for a wallet and a chain.
 *
 * The ZK artifacts are passed in rather than located here: a command line run reads them from
 * disk, a browser fetches them over HTTP, and nothing else about this differs.
 */
export const configureProviders = async (
  ctx: WalletContext,
  endpoints: ChainEndpoints,
  zkConfigProvider: ZKConfigProvider<BlindsideCircuits>,
) => {
  const walletAndMidnightProvider = await createWalletAndMidnightProvider(ctx);
  const accountId = walletAndMidnightProvider.getCoinPublicKey();
  const storagePassword = `${Buffer.from(accountId, "hex").toString("base64")}!`;

  return {
    privateStateProvider: levelPrivateStateProvider<typeof PRIVATE_STATE_ID>({
      privateStateStoreName: PRIVATE_STATE_STORE,
      accountId,
      privateStoragePasswordProvider: () => storagePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(endpoints.indexer, endpoints.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(endpoints.proofServer, zkConfigProvider),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  };
};

export type BlindsideProviders = Awaited<ReturnType<typeof configureProviders>>;
