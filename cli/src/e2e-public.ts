// A full game against a public Midnight test network. Needs a funded wallet and a local proof
// server.
//
//   pnpm --filter @blindside/cli address preview   # fund what it prints
//   pnpm --filter @blindside/cli public preview
// SPDX-License-Identifier: Apache-2.0

import { PUBLIC_NETWORKS, isPublicNetwork, publicConfig } from "./config.ts";
import { runFullGame } from "./game-run.ts";
import { loadOrCreateSeed } from "./public-wallet.ts";

// Small enough that one faucet grant covers a whole game several times over.
const ENTRY_FEE = 1_000_000n;

const requested = process.argv[2] ?? "preview";
if (!isPublicNetwork(requested)) {
  console.error(
    `\n  Unknown network "${requested}". Try one of: ${Object.keys(PUBLIC_NETWORKS).join(", ")}\n`,
  );
  process.exit(1);
}

await runFullGame({
  config: publicConfig(requested),
  seed: loadOrCreateSeed(requested),
  network: requested,
  entryFee: ENTRY_FEE,
});

process.exit(0);
