// Every chain Blindside can run on, in one list, so the command line runner and the browser
// console can never disagree about where a network lives.
//
// The proof server is always local to whoever is running the game. Proving needs the private
// inputs, so it is not something to hand to a stranger's machine.
// SPDX-License-Identifier: Apache-2.0

import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";

/** Where a chain is, whoever is talking to it. */
export type ChainEndpoints = {
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly proofServer: string;
};

export type ChainNetwork = ChainEndpoints & {
  readonly id: string;
  readonly label: string;
  /** Where to get test tokens, or null for a chain that mints its own. */
  readonly faucet: string | null;
};

const LOCAL_PROOF_SERVER = "http://127.0.0.1:6300";

const publicNetwork = (id: string, label: string): ChainNetwork => ({
  id,
  label,
  indexer: `https://indexer.${id}.midnight.network/api/v4/graphql`,
  indexerWS: `wss://indexer.${id}.midnight.network/api/v4/graphql/ws`,
  node: `https://rpc.${id}.midnight.network`,
  proofServer: LOCAL_PROOF_SERVER,
  faucet: `https://faucet.${id}.midnight.network`,
});

/** A whole Midnight network on this machine: node, indexer and prover in Docker. */
export const LOCAL_NETWORK: ChainNetwork = {
  id: "undeployed",
  label: "A chain on this machine",
  indexer: "http://127.0.0.1:8088/api/v4/graphql",
  indexerWS: "ws://127.0.0.1:8088/api/v4/graphql/ws",
  node: "http://127.0.0.1:9944",
  proofServer: LOCAL_PROOF_SERVER,
  faucet: null,
};

export const NETWORKS: readonly ChainNetwork[] = [
  publicNetwork("preview", "Midnight preview"),
  publicNetwork("preprod", "Midnight preprod"),
  LOCAL_NETWORK,
];

/** The same faucet on a second host. Worth trying when the first one will not have you. */
export const faucetMirror = (id: string): string =>
  `https://midnight-tmnight-${id}.nethermind.dev/`;

export const networkIds = (): readonly string[] => NETWORKS.map((network) => network.id);

export const findNetwork = (id: string): ChainNetwork | null =>
  NETWORKS.find((network) => network.id === id) ?? null;

/**
 * Sets the global network id, which the wallet and every address encoder read. Nothing that
 * touches a chain works until this has been called, so it is the one side effect worth having.
 */
export const useNetwork = (network: ChainNetwork): ChainNetwork => {
  setNetworkId(network.id);
  return network;
};
