// Player identity. One secret per player, everything else derived from it.
// SPDX-License-Identifier: Apache-2.0

import { x25519 } from "@noble/curves/ed25519";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { randomBytes } from "@noble/hashes/utils";
import { pureCircuits } from "@blindside/contract";

export const SECRET_BYTES = 32;

const X25519_INFO = "blindside:x25519:v1";

export type EncKeyPair = {
  readonly secretKey: Uint8Array;
  readonly publicKey: Uint8Array;
};

/**
 * Everything a player is, on chain and off.
 *
 * `secret` never leaves the device. `tagToken` is handed over only when tagged. `commitment` is
 * the pseudonym published at join, and `encPublicKey` is how the host seals this player's target
 * envelope to them.
 */
export type Identity = {
  readonly secret: Uint8Array;
  readonly tagToken: Uint8Array;
  readonly commitment: Uint8Array;
  readonly encPublicKey: Uint8Array;
  readonly encSecretKey: Uint8Array;
};

export const newSecret = (): Uint8Array => randomBytes(SECRET_BYTES);

/** Deterministic encryption keys, so a player only ever has one thing to back up. */
export const encKeyPairFrom = (secret: Uint8Array): EncKeyPair => {
  assertSecret(secret);
  const secretKey = hkdf(sha256, secret, undefined, X25519_INFO, 32);
  return { secretKey, publicKey: x25519.getPublicKey(secretKey) };
};

export const identityFrom = (secret: Uint8Array): Identity => {
  assertSecret(secret);
  const tagToken = pureCircuits.tagTokenOf(secret);
  const { secretKey, publicKey } = encKeyPairFrom(secret);
  return {
    secret,
    tagToken,
    commitment: pureCircuits.playerOf(tagToken),
    encPublicKey: publicKey,
    encSecretKey: secretKey,
  };
};

export const newIdentity = (): Identity => identityFrom(newSecret());

function assertSecret(secret: Uint8Array): void {
  if (secret.length !== SECRET_BYTES) {
    throw new Error(`A player secret must be ${SECRET_BYTES} bytes`);
  }
}
