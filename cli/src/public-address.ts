// Prints the address to fund before a run on a public network, creating the wallet on first use.
//
//   pnpm --filter @blindside/cli address preview
// SPDX-License-Identifier: Apache-2.0

import { addressForSeed, faucetMirror, useNetwork } from "@blindside/chain";
import { publicNetworkFromArgv } from "./network-arg.ts";
import { loadOrCreateSeed, seedExists } from "./seed-file.ts";

const network = useNetwork(publicNetworkFromArgv());

const existed = seedExists(network.id);
const address = addressForSeed(loadOrCreateSeed(network.id));

console.log(`\n  ${existed ? "Using" : "Created"} a ${network.id} wallet.\n`);
console.log(`  Fund this address:\n\n  ${address}\n`);
console.log(`  1. Open ${network.faucet}`);
console.log("     Each network has its own faucet, and each rejects the others' addresses.");
console.log("  2. Paste the address above and request tokens");
console.log(`  3. Run: pnpm --filter @blindside/cli public ${network.id}\n`);
console.log(`  A second host serves the same faucet: ${faucetMirror(network.id)}`);
console.log("  The faucet takes an unshielded address and only that form, and decodes it");
console.log("  against the network its own server is set to. \"Provided address is invalid\"");
console.log("  means those two disagree, not that the address above is malformed.\n");
