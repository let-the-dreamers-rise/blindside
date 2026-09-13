// Prints the address to fund before a run on a public network, creating the wallet on first use.
//
//   pnpm --filter @blindside/cli address preview
// SPDX-License-Identifier: Apache-2.0

import { PUBLIC_NETWORKS, isPublicNetwork, publicConfig } from "./config.ts";
import { addressForSeed, loadOrCreateSeed, seedExists } from "./public-wallet.ts";

const requested = process.argv[2] ?? "preview";
if (!isPublicNetwork(requested)) {
  console.error(
    `\n  Unknown network "${requested}". Try one of: ${Object.keys(PUBLIC_NETWORKS).join(", ")}\n`,
  );
  process.exit(1);
}

publicConfig(requested);

const existed = seedExists(requested);
const address = addressForSeed(loadOrCreateSeed(requested));

console.log(`\n  ${existed ? "Using" : "Created"} a ${requested} wallet.\n`);
console.log(`  Fund this address:\n\n  ${address}\n`);
console.log(`  1. Open ${PUBLIC_NETWORKS[requested]}`);
console.log("     Each network has its own faucet, and each rejects the others' addresses.");
console.log("  2. Paste the address above and request tokens");
console.log(`  3. Run: pnpm --filter @blindside/cli public ${requested}\n`);
