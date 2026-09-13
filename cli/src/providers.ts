// Wiring between the wallet SDK and midnight-js. Adapted from midnightntwrk/example-counter
// (Apache-2.0).
// SPDX-License-Identifier: Apache-2.0

import * as Rx from "rxjs";
import * as ledger from "@midnight-ntwrk/ledger-v8";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import type {
  MidnightProvider,
  WalletProvider,
} from "@midnight-ntwrk/midnight-js/types";
import { type Config, contractConfig } from "./config.ts";
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

/**
 * Signs unshielded offers with the right proof marker.
 *
 * The wallet SDK hardcodes 'pre-proof' when cloning intents, which fails for already proven
 * intents. Same workaround as the official example.
 */
const signTransactionIntents = (
  tx: { intents?: Map<number, ledger.Intent<ledger.SignatureEnabled, ledger.Proofish, ledger.PreBinding>> },
  signFn: (payload: Uint8Array) => ledger.Signature,
  proofMarker: "proof" | "pre-proof",
): void => {
  if (tx.intents === undefined || tx.intents.size === 0) {
    return;
  }

  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (intent === undefined) {
      continue;
    }

    const cloned = ledger.Intent.deserialize<
      ledger.SignatureEnabled,
      ledger.Proofish,
      ledger.PreBinding
    >("signature", proofMarker, "pre-binding", intent.serialize());

    const signature = signFn(cloned.signatureData(segment));

    if (cloned.fallibleUnshieldedOffer) {
      cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(
        cloned.fallibleUnshieldedOffer.inputs.map(
          (_: ledger.UtxoSpend, index: number) =>
            cloned.fallibleUnshieldedOffer?.signatures.at(index) ?? signature,
        ),
      );
    }

    if (cloned.guaranteedUnshieldedOffer) {
      cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(
        cloned.guaranteedUnshieldedOffer.inputs.map(
          (_: ledger.UtxoSpend, index: number) =>
            cloned.guaranteedUnshieldedOffer?.signatures.at(index) ?? signature,
        ),
      );
    }

    tx.intents.set(segment, cloned);
  }
};

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

export const configureProviders = async (ctx: WalletContext, config: Config) => {
  const walletAndMidnightProvider = await createWalletAndMidnightProvider(ctx);
  const zkConfigProvider = new NodeZkConfigProvider<BlindsideCircuits>(
    contractConfig.zkConfigPath,
  );
  const accountId = walletAndMidnightProvider.getCoinPublicKey();
  const storagePassword = `${Buffer.from(accountId, "hex").toString("base64")}!`;

  return {
    privateStateProvider: levelPrivateStateProvider<typeof PRIVATE_STATE_ID>({
      privateStateStoreName: contractConfig.privateStateStoreName,
      accountId,
      privateStoragePasswordProvider: () => storagePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  };
};

export type BlindsideProviders = Awaited<ReturnType<typeof configureProviders>>;
