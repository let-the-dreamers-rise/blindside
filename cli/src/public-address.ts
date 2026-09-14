// Prints the address to fund before a run on a public network, creating the wallet on first use.
//
//   pnpm --filter @blindside/cli address preview
// SPDX-License-Identifier: Apache-2.0

import { addressForSeed, shieldedAddressForSeed, useNetwork } from "@blindside/chain";
import { publicNetworkFromArgv } from "./network-arg.ts";
import { loadOrCreateSeed, seedExists } from "./seed-file.ts";

const network = useNetwork(publicNetworkFromArgv());

const existed = seedExists(network.id);
const seed = loadOrCreateSeed(network.id);
const address = addressForSeed(seed);
const shielded = shieldedAddressForSeed(seed);

console.log(`\n  ${existed ? "Using" : "Created"} a ${network.id} wallet.\n`);
console.log(`  Fund this address:\n\n  ${address}\n`);
console.log(`  1. Open ${network.faucet}`);
console.log("     Each network has its own faucet, and each rejects the others' addresses.");
console.log("  2. Paste the address above and request tokens");
console.log(`  3. Run: pnpm --filter @blindside/cli public ${network.id}\n`);
console.log("  If the faucet calls that address invalid, it wants the shielded form:\n");
console.log(`  ${shielded}\n`);
if (network.id === "preview") {
  console.log("  There is a second host for the same faucet, worth trying if one refuses you:");
  console.log("  https://faucet.preview.midnight.network\n");
}
