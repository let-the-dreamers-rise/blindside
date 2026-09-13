// The one thing a player hands their organizer: a join card.
//
// It is short enough to be a QR on a phone screen or a line pasted into a chat, and every byte of
// it is public. It carries the player's pseudonym, the public half of the key their five words
// unlock, and their own tag token already sealed to that key. The organizer needs all three and
// can read none of the last one, which is exactly the point: they enrol a player without ever
// holding what it takes to tag them.
// SPDX-License-Identifier: Apache-2.0

import { base64UrlDecode, base64UrlEncode, sanitizeName } from "../crypto/text.js";
import type { PlayerCard } from "./cycle.js";
import { SEALED_BYTES } from "./sealed.js";

const PREFIX = "blindsidejoin1";
const KEY_BYTES = 32;
const HEAD_BYTES = KEY_BYTES * 2 + SEALED_BYTES;
const MAX_NAME_BYTES = 60;

export class JoinCardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JoinCardError";
  }
}

export const encodeJoinCard = (card: PlayerCard): string => {
  if (card.commitment.length !== KEY_BYTES || card.wordPublicKey.length !== KEY_BYTES) {
    throw new JoinCardError("That is not a player");
  }
  if (card.sealedTagToken.length !== SEALED_BYTES) {
    throw new JoinCardError("That is not a sealed tag token");
  }

  const name = new TextEncoder().encode(sanitizeName(card.name)).slice(0, MAX_NAME_BYTES);
  const bytes = new Uint8Array(HEAD_BYTES + name.length);
  bytes.set(card.commitment, 0);
  bytes.set(card.wordPublicKey, KEY_BYTES);
  bytes.set(card.sealedTagToken, KEY_BYTES * 2);
  bytes.set(name, HEAD_BYTES);

  return `${PREFIX}.${base64UrlEncode(bytes)}`;
};

/** Throws rather than guessing: a mistyped card should fail loudly, before anybody pays. */
export const decodeJoinCard = (text: string): PlayerCard => {
  const [prefix, payload, ...rest] = text.trim().split(".");
  if (prefix !== PREFIX || payload === undefined || rest.length > 0) {
    throw new JoinCardError("That is not a Blindside join card");
  }
  if (payload.length > (HEAD_BYTES + MAX_NAME_BYTES) * 2) {
    throw new JoinCardError("That card is too long to be one of ours");
  }

  const bytes = base64UrlDecode(payload);
  if (bytes === null || bytes.length < HEAD_BYTES) {
    throw new JoinCardError("That is not a Blindside join card");
  }

  return {
    commitment: bytes.slice(0, KEY_BYTES),
    wordPublicKey: bytes.slice(KEY_BYTES, KEY_BYTES * 2),
    sealedTagToken: bytes.slice(KEY_BYTES * 2, HEAD_BYTES),
    name: sanitizeName(new TextDecoder().decode(bytes.slice(HEAD_BYTES))),
  };
};
