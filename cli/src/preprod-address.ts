// Prints the address to fund before a preprod run, creating the wallet on first use.
// SPDX-License-Identifier: Apache-2.0

import { PreprodConfig } from "./config.ts";
import { addressForSeed, loadOrCreateSeed, seedExists } from "./preprod-wallet.ts";

new PreprodConfig();

const existed = seedExists();
const address = addressForSeed(loadOrCreateSeed());

console.log(`\n  ${existed ? "Using" : "Created"} a preprod wallet.\n`);
console.log(`  Fund this address:\n\n  ${address}\n`);
console.log("  1. Open https://faucet.preprod.midnight.network/");
console.log("  2. Paste the address above and request tokens");
console.log("  3. Run: pnpm --filter @blindside/cli preprod\n");
