// A full game against the standalone stack: node, indexer and proof server in Docker on this
// machine. Bring it up with `pnpm --filter @blindside/cli stack:up` first.
// SPDX-License-Identifier: Apache-2.0

import { StandaloneConfig } from "./config.ts";
import { runFullGame } from "./game-run.ts";
import { GENESIS_MINT_WALLET_SEED } from "./wallet.ts";

await runFullGame({
  config: new StandaloneConfig(),
  seed: GENESIS_MINT_WALLET_SEED,
  network: "standalone",
  entryFee: 10n,
});

process.exit(0);
