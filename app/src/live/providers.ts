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

export const providersFor = (
  ctx: WalletContext,
  endpoints: ChainEndpoints,
): Promise<BlindsideProviders> =>
  configureProviders(
    ctx,
    endpoints,
    new FetchZkConfigProvider<BlindsideCircuits>(zkBase(), boundFetch),
  );
