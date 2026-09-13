// The wallet used for preprod runs. Its seed lives in a gitignored file and is never printed:
// losing it only costs test tokens, so there is no recovery path and no reason to want one.
// SPDX-License-Identifier: Apache-2.0

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as ledger from "@midnight-ntwrk/ledger-v8";
import {
  MidnightBech32m,
  UnshieldedAddress,
} from "@midnight-ntwrk/wallet-sdk-address-format";
import { getNetworkId } from "@midnight-ntwrk/midnight-js/network-id";
import { HDWallet, Roles } from "@midnight-ntwrk/wallet-sdk-hd";
import { createKeystore } from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";

export const SEED_PATH = path.resolve(process.cwd(), "..", "secrets", "preprod.seed");

export const seedExists = (): boolean => existsSync(SEED_PATH);

/** Reads the wallet seed, generating one the first time. Never log the result. */
export const loadOrCreateSeed = (): string => {
  if (existsSync(SEED_PATH)) {
    return readFileSync(SEED_PATH, "utf8").trim();
  }
  mkdirSync(path.dirname(SEED_PATH), { recursive: true });
  const seed = randomBytes(32).toString("hex");
  writeFileSync(SEED_PATH, `${seed}\n`, { mode: 0o600 });
  return seed;
};

/** The address a faucet pays. Safe to publish: it is a public key, not a secret. */
export const addressForSeed = (seed: string): string => {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, "hex"));
  if (hdWallet.type !== "seedOk") {
    throw new Error("that seed is not usable");
  }
  const derived = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.NightExternal])
    .deriveKeysAt(0);
  if (derived.type !== "keysDerived") {
    throw new Error("could not derive the wallet keys");
  }
  hdWallet.hdWallet.clear();

  const keystore = createKeystore(derived.keys[Roles.NightExternal], getNetworkId());
  const raw = ledger.encodeUserAddress(
    ledger.addressFromKey(keystore.getPublicKey()),
  );
  return MidnightBech32m.encode(
    getNetworkId(),
    new UnshieldedAddress(Buffer.from(raw)),
  ).asString();
};
