// The provider set for a game run from a browser tab.
//
// The only thing that differs from the command line runner is where the proving material comes
// from: a script serves it next to the app, and this fetches it over HTTP. Everything else, the
// wallet, the signing and the indexer wiring, is the same code in @blindside/chain.
// SPDX-License-Identifier: Apache-2.0

import {
  type BlindsideCircuits,
  type BlindsideProviders,
  type ChainEndpoints,
  type WalletContext,
  configureProviders,
} from "@blindside/chain";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";

/** Absolute, because the provider builds URLs from it and a relative base would not resolve. */
const zkBase = (): string => new URL("zk", document.baseURI).toString();

/**
 * A browser's fetch has to be called on the window.
 *
 * The provider keeps whatever it is given and calls it as a plain function, and the default it
 * reaches for comes through cross-fetch unbound, so every request throws "Illegal invocation"
 * before it leaves the tab. Binding it here is the whole fix.
 */
const boundFetch = globalThis.fetch.bind(globalThis);

/** Every circuit the contract has. A game only calls four of them, but a deploy publishes all. */
const CIRCUITS = [
  "join",
  "startGame",
  "tag",
  "claimVictory",
  "resign",
  "openRefunds",
  "cancel",
  "refund",
] as const;

/**
 * Reads every verifier key once, in order, before anything is deployed.
 *
 * Two reasons. A deploy publishes all eight keys at once, and eight parallel reads of files that
 * run to nineteen megabytes is the kind of thing that half-succeeds quietly; doing it here in
 * order means a missing or truncated asset is an error on this page, with a name attached,
 * rather than a confusing refusal from a proof server twenty minutes into a game.
 */
export const warmZkAssets = async (
  provider: FetchZkConfigProvider<BlindsideCircuits>,
): Promise<void> => {
  for (const circuit of CIRCUITS) {
    try {
      await provider.getVerifierKey(circuit);
    } catch (cause) {
      throw new Error(`The proving material for ${circuit} could not be read`, { cause });
    }
  }
};

export const providersFor = async (
  ctx: WalletContext,
  endpoints: ChainEndpoints,
): Promise<BlindsideProviders> => {
  const zk = new FetchZkConfigProvider<BlindsideCircuits>(zkBase(), boundFetch);
  await warmZkAssets(zk);
  return configureProviders(ctx, endpoints, zk);
};
