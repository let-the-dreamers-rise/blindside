// A full game against Midnight preprod, the public test network. Needs a funded wallet: run
// `pnpm --filter @blindside/cli preprod:address` and fund what it prints, and keep a proof
// server running locally.
// SPDX-License-Identifier: Apache-2.0

import { PreprodConfig } from "./config.ts";
import { runFullGame } from "./game-run.ts";
import { loadOrCreateSeed } from "./preprod-wallet.ts";

// Small enough that one faucet grant covers a whole game several times over.
const ENTRY_FEE = 1_000_000n;

await runFullGame({
  config: new PreprodConfig(),
  seed: loadOrCreateSeed(),
  network: "preprod",
  entryFee: ENTRY_FEE,
});

process.exit(0);
