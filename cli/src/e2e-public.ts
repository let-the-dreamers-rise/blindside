// A full game against a public Midnight test network. Needs a funded wallet and a local proof
// server.
//
//   pnpm --filter @blindside/cli address preprod   # fund what it prints
//   pnpm --filter @blindside/cli public preprod
//
// The script raises Node's heap to 7 GB, which is not decoration. A public network has real
// history behind it and the wallet syncs the whole of it before it will sign anything: on the
// default 2 GB heap this dies of an out-of-memory roughly six minutes in, after the point where
// it looks like it is working. Stopping the local node and indexer first, if they are up, gives
// the sync the rest of the machine.
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
