// A game wallet's seed: 32 bytes, generated here and never typed in.
//
// There is no field anywhere in this project that asks for a seed phrase. A game wallet holds
// test tokens and nothing else, so a lost seed costs a faucet visit and a found one is worth
// nothing. That is a deliberate ceiling on what can go wrong.
// SPDX-License-Identifier: Apache-2.0

import { HDWallet, Roles } from "@midnight-ntwrk/wallet-sdk-hd";

const SEED_BYTES = 32;

export const fromHex = (value: string): Uint8Array => {
  const pairs = value.trim().match(/../g);
  if (pairs === null || pairs.length !== SEED_BYTES || !/^[0-9a-f]+$/i.test(value.trim())) {
    throw new Error(`a wallet seed is ${SEED_BYTES} bytes of hex`);
  }
  return Uint8Array.from(pairs.map((byte) => Number.parseInt(byte, 16)));
};

/** 32 random bytes, hex encoded. The only place a new wallet ever comes from. */
export const newSeed = (): string =>
  [...crypto.getRandomValues(new Uint8Array(SEED_BYTES))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

/** Funds minted in the genesis block of a local development node. Standalone chains only. */
export const GENESIS_MINT_WALLET_SEED =
  "0000000000000000000000000000000000000000000000000000000000000001";

const ROLES = [Roles.Zswap, Roles.NightExternal, Roles.Dust] as const;

/** The three keys a Midnight wallet runs on, derived from one seed at account zero. */
export const deriveKeys = (seed: string) => {
  const hd = HDWallet.fromSeed(Buffer.from(fromHex(seed)));
  if (hd.type !== "seedOk") {
    throw new Error("that seed is not usable");
  }
  const derived = hd.hdWallet.selectAccount(0).selectRoles([...ROLES]).deriveKeysAt(0);
  if (derived.type !== "keysDerived") {
    throw new Error("could not derive the wallet keys");
  }
  hd.hdWallet.clear();
  return derived.keys;
};
