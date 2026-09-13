// Reading a network name off the command line, with an error that says what the options are.
// SPDX-License-Identifier: Apache-2.0

import { type ChainNetwork, NETWORKS, findNetwork } from "@blindside/chain";

const DEFAULT_NETWORK = "preview";

const withFaucet = (): readonly ChainNetwork[] =>
  NETWORKS.filter((network) => network.faucet !== null);

/** The public network named in argv, or exits explaining which names work. */
export const publicNetworkFromArgv = (): ChainNetwork => {
  const requested = process.argv[2] ?? DEFAULT_NETWORK;
  const network = findNetwork(requested);
  const names = withFaucet()
    .map((candidate) => candidate.id)
    .join(", ");

  if (network === null) {
    console.error(`\n  Unknown network "${requested}". Try one of: ${names}\n`);
    process.exit(1);
  }
  if (network.faucet === null) {
    console.error(
      `\n  ${network.id} mints its own tokens, so it has no faucet.` +
        `\n  Run it with: pnpm --filter @blindside/cli local\n`,
    );
    process.exit(1);
  }
  return network;
};
