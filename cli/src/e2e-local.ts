// A full game against the standalone stack: node, indexer and proof server in Docker on this
// machine. Bring it up with `pnpm --filter @blindside/cli stack:up` first.
// SPDX-License-Identifier: Apache-2.0

import { GENESIS_MINT_WALLET_SEED, LOCAL_NETWORK, useNetwork } from "@blindside/chain";
import { runFullGame } from "./game-run.ts";

await runFullGame({
  network: useNetwork(LOCAL_NETWORK),
  seed: GENESIS_MINT_WALLET_SEED,
  entryFee: 10n,
});

process.exit(0);
