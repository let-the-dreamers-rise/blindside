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
 * A public Midnight test network. The proof server stays local whichever one is used: proving
 * needs the private inputs, so it is not something to hand to somebody else's machine.
 */
class PublicConfig implements Config {
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly proofServer = "http://127.0.0.1:6300";

  constructor(readonly name: string) {
    this.indexer = `https://indexer.${name}.midnight.network/api/v4/graphql`;
    this.indexerWS = `wss://indexer.${name}.midnight.network/api/v4/graphql/ws`;
    this.node = `https://rpc.${name}.midnight.network`;
    setNetworkId(name);
  }
}

export const PUBLIC_NETWORKS = {
  preview: "https://midnight-tmnight-preview.nethermind.dev/",
  preprod: "https://midnight-tmnight-preprod.nethermind.dev/",
} as const;

export type PublicNetwork = keyof typeof PUBLIC_NETWORKS;

export const isPublicNetwork = (value: string): value is PublicNetwork =>
  Object.hasOwn(PUBLIC_NETWORKS, value);

/** Builds the config for a public network, setting the global network id as a side effect. */
export const publicConfig = (name: PublicNetwork): Config => new PublicConfig(name);
