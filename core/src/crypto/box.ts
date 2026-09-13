// Sealed envelopes. The host seals each player's target to that player's key, and nobody else,
// including anyone reading the chain, can open it.
// SPDX-License-Identifier: Apache-2.0

import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import { x25519 } from "@noble/curves/ed25519";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { randomBytes } from "@noble/hashes/utils";

const EPHEMERAL_KEY_BYTES = 32;
const NONCE_BYTES = 24;
const SEAL_INFO = "blindside:seal:v1";

/** ephemeral public key || nonce || ciphertext */
export const seal = (
  recipientPublicKey: Uint8Array,
  plaintext: Uint8Array,
): Uint8Array => {
  const ephemeralSecret = x25519.utils.randomPrivateKey();
  const ephemeralPublic = x25519.getPublicKey(ephemeralSecret);
  const key = sealKey(x25519.getSharedSecret(ephemeralSecret, recipientPublicKey), ephemeralPublic);
  const nonce = randomBytes(NONCE_BYTES);
  const ciphertext = xchacha20poly1305(key, nonce).encrypt(plaintext);

  const sealed = new Uint8Array(
    EPHEMERAL_KEY_BYTES + NONCE_BYTES + ciphertext.length,
  );
  sealed.set(ephemeralPublic, 0);
  sealed.set(nonce, EPHEMERAL_KEY_BYTES);
  sealed.set(ciphertext, EPHEMERAL_KEY_BYTES + NONCE_BYTES);
  return sealed;
};

/**
 * Returns null rather than throwing when the envelope is not ours: players trial-open every
 * envelope in the game, and exactly one is theirs.
 */
export const unseal = (
  recipientSecretKey: Uint8Array,
  sealed: Uint8Array,
): Uint8Array | null => {
  if (sealed.length <= EPHEMERAL_KEY_BYTES + NONCE_BYTES) {
    return null;
  }
  try {
    const ephemeralPublic = sealed.slice(0, EPHEMERAL_KEY_BYTES);
    const nonce = sealed.slice(EPHEMERAL_KEY_BYTES, EPHEMERAL_KEY_BYTES + NONCE_BYTES);
    const ciphertext = sealed.slice(EPHEMERAL_KEY_BYTES + NONCE_BYTES);
    const key = sealKey(
      x25519.getSharedSecret(recipientSecretKey, ephemeralPublic),
      ephemeralPublic,
    );
    return xchacha20poly1305(key, nonce).decrypt(ciphertext);
  } catch {
    return null;
  }
};

const sealKey = (shared: Uint8Array, salt: Uint8Array): Uint8Array =>
  hkdf(sha256, shared, salt, SEAL_INFO, 32);
