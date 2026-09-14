// Turning a wallet into the two forms of address this game needs: the Bech32m string a faucet
// pays, and the 32 raw bytes the contract stores as a payout address.
// SPDX-License-Identifier: Apache-2.0

import * as ledger from "@midnight-ntwrk/ledger-v8";
import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import {
  MidnightBech32m,
  ShieldedAddress,
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey,
  UnshieldedAddress,
} from "@midnight-ntwrk/wallet-sdk-address-format";
import { Roles } from "@midnight-ntwrk/wallet-sdk-hd";
import {
  createKeystore,
  type UnshieldedKeystore,
} from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import { deriveKeys } from "./seed.ts";

export const PAYOUT_ADDRESS_BYTES = 32;

/** The same 32 bytes the contract stores as a payout address, bound at join. */
export const payoutBytesOf = (keystore: UnshieldedKeystore): Uint8Array => {
  const bytes = ledger.encodeUserAddress(
    ledger.addressFromKey(keystore.getPublicKey()),
  );
  if (bytes.length !== PAYOUT_ADDRESS_BYTES) {
    throw new Error(
      `expected a ${PAYOUT_ADDRESS_BYTES} byte payout address, got ${bytes.length}`,
    );
  }
  return bytes;
};

/** The address a faucet pays. A public key: safe to show, safe to copy, safe to publish. */
export const addressOf = (keystore: UnshieldedKeystore): string =>
  MidnightBech32m.encode(
    getNetworkId(),
    new UnshieldedAddress(Buffer.from(payoutBytesOf(keystore))),
  ).asString();

/** The address for a seed on the current network, without starting a wallet to find it. */
export const addressForSeed = (seed: string): string =>
  addressOf(createKeystore(deriveKeys(seed)[Roles.NightExternal], getNetworkId()));

/**
 * The same wallet's shielded address. A faucet hands out NIGHT, which is unshielded, so the
 * address above is the one to paste; this is here because a faucet that turns down a
 * well formed unshielded address usually wanted this form, and finding that out should not
 * cost a second trip to the machine that holds the seed.
 */
export const shieldedAddressForSeed = (seed: string): string => {
  const zswap = ledger.ZswapSecretKeys.fromSeed(deriveKeys(seed)[Roles.Zswap]);
  return MidnightBech32m.encode(
    getNetworkId(),
    new ShieldedAddress(
      ShieldedCoinPublicKey.fromHexString(zswap.coinPublicKey),
      ShieldedEncryptionPublicKey.fromHexString(zswap.encryptionPublicKey),
    ),
  ).asString();
};
