// A full game against a public Midnight test network. Needs a funded wallet and a local proof
// server.
//
//   pnpm --filter @blindside/cli address preview   # fund what it prints
//   pnpm --filter @blindside/cli public preview
// SPDX-License-Identifier: Apache-2.0

import { useNetwork } from "@blindside/chain";
import { runFullGame } from "./game-run.ts";
import { publicNetworkFromArgv } from "./network-arg.ts";
import { loadOrCreateSeed } from "./seed-file.ts";

// Small enough that one faucet grant covers a whole game several times over.
const ENTRY_FEE = 1_000_000n;

const network = publicNetworkFromArgv();

await runFullGame({
  network: useNetwork(network),
  seed: loadOrCreateSeed(network.id),
  entryFee: ENTRY_FEE,
});

process.exit(0);
