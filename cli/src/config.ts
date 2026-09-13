// Network configuration. Adapted from midnightntwrk/example-counter (Apache-2.0).
// SPDX-License-Identifier: Apache-2.0

import path from "node:path";
import { setNetworkId } from "@midnight-ntwrk/midnight-js/network-id";

export const currentDir = path.resolve(new URL(import.meta.url).pathname, "..");

export const contractConfig = {
  privateStateStoreName: "blindside-private-state",
  zkConfigPath: path.resolve(
    currentDir,
    "..",
    "..",
    "contract",
    "src",
    "managed",
    "blindside",
  ),
};

export interface Config {
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly proofServer: string;
}

/** A whole Midnight network on this machine: node, indexer and prover in Docker. */
export class StandaloneConfig implements Config {
  indexer = "http://127.0.0.1:8088/api/v4/graphql";
  indexerWS = "ws://127.0.0.1:8088/api/v4/graphql/ws";
  node = "http://127.0.0.1:9944";
  proofServer = "http://127.0.0.1:6300";
  constructor() {
    setNetworkId("undeployed");
  }
}

/**
 * Midnight preprod, the public test network. The proof server stays local: proving needs the
 * private inputs, so it is not something to hand to somebody else's machine.
 */
export class PreprodConfig implements Config {
  indexer = "https://indexer.preprod.midnight.network/api/v4/graphql";
  indexerWS = "wss://indexer.preprod.midnight.network/api/v4/graphql/ws";
  node = "https://rpc.preprod.midnight.network";
  proofServer = "http://127.0.0.1:6300";
  constructor() {
    setNetworkId("preprod");
  }
}
