// Reading a live game straight from a Midnight indexer. No wallet and no private state: a
// spectator sees exactly what the chain publishes, which is the point.
//
// This talks to the indexer's GraphQL endpoint directly and decodes the state with the same
// runtime the contract already needs. The official provider would do the same job and bring a
// ten megabyte ledger WASM with it, which a spectator has no use for.
// SPDX-License-Identifier: Apache-2.0

import { ledger } from "@blindside/contract";
import { ContractState } from "@midnight-ntwrk/compact-runtime";

export type Network = {
  readonly id: "local" | "preprod";
  readonly label: string;
  readonly indexer: string;
};

export const NETWORKS: readonly Network[] = [
  {
    id: "local",
    label: "A chain on this machine",
    indexer: "http://127.0.0.1:8088/api/v3/graphql",
  },
  {
    id: "preprod",
    label: "Midnight preprod",
    indexer: "https://indexer.preprod.midnight.network/api/v3/graphql",
  },
];

export type PublicGame = {
  readonly phase: number;
  readonly players: number;
  readonly alive: number;
  readonly tags: number;
  readonly pot: bigint;
  readonly entryFee: bigint;
  readonly spent: readonly string[];
  readonly commitments: readonly string[];
  readonly leaves: number;
  readonly deadDrops: number;
};

const QUERY = "query Game($address: HexEncoded!) { contractAction(address: $address) { state } }";

const hex = (bytes: Uint8Array): string =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const fromHex = (value: string): Uint8Array => {
  const pairs = value.match(/../g);
  if (pairs === null) {
    throw new Error("the indexer returned a state that is not hex");
  }
  return Uint8Array.from(pairs.map((byte) => Number.parseInt(byte, 16)));
};

/** A contract address is 64 hex characters. Checked here so a typo fails before a network call. */
export const looksLikeAddress = (value: string): boolean =>
  /^[0-9a-f]{64}$/i.test(value.trim());

type Response = {
  readonly data?: { readonly contractAction?: { readonly state?: string } | null } | null;
};

/** Returns null when there is no contract at that address, and throws when the chain is not there. */
export const readGame = async (
  network: Network,
  address: string,
): Promise<PublicGame | null> => {
  const response = await fetch(network.indexer, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: QUERY,
      variables: { address: address.trim().toLowerCase() },
    }),
  });
  if (!response.ok) {
    throw new Error(`the indexer answered ${response.status}`);
  }

  const body = (await response.json()) as Response;
  const state = body.data?.contractAction?.state;
  if (typeof state !== "string" || state.length === 0) {
    return null;
  }

  const current = ledger(ContractState.deserialize(fromHex(state)).data);
  return {
    phase: Number(current.phase),
    players: Number(current.playerCount),
    alive: Number(current.aliveCount),
    tags: Number(current.tagCount),
    pot: current.pot,
    entryFee: current.entryFee,
    spent: [...current.spent].map(hex),
    commitments: [...current.players].map(hex),
    leaves: Number(current.edges.firstFree()),
    deadDrops: Number(current.deadDrops.size()),
  };
};

const PHASE_LABELS = [
  "Taking players",
  "Running",
  "Finished",
  "Timed out, refunds open",
  "Cancelled, refunds open",
] as const;

export const phaseLabel = (phase: number): string => PHASE_LABELS[phase] ?? "Unknown";
