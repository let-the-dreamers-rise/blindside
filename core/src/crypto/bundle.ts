// The code a victim shows when they are tagged, and the envelope the host sends each player.
// Both are untrusted input by the time they are read, so both are parsed, never assumed.
// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";

export const TAG_CODE_VERSION = 1;
export const MAX_NAME_LENGTH = 24;
export const MAX_ENCODED_LENGTH = 1024;

const hex32 = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "expected 32 bytes of hex");

const tagCodeSchema = z.object({
  v: z.literal(TAG_CODE_VERSION),
  g: z.string().min(1).max(128), // the game this code belongs to
  t: hex32, // tag token
  tg: hex32, // the victim's target
  r: hex32, // the victim's note randomness
  n: z.string().max(MAX_NAME_LENGTH),
});

export type TagCode = {
  readonly game: string;
  readonly tagToken: Uint8Array;
  readonly target: Uint8Array;
  readonly rand: Uint8Array;
  readonly targetName: string;
};

export class TagCodeError extends Error {
  constructor(
    message: string,
    readonly reason: "malformed" | "wrong-game" | "too-long",
  ) {
    super(message);
    this.name = "TagCodeError";
  }
}

/** Names come from other people, so they are stripped before they are ever rendered. */
export const sanitizeName = (raw: string): string =>
  [...raw.replace(/[\p{C}]/gu, "").trim()].slice(0, MAX_NAME_LENGTH).join("");

export const encodeTagCode = (code: TagCode): string => {
  const payload = {
    v: TAG_CODE_VERSION,
    g: code.game,
    t: toHex(code.tagToken),
    tg: toHex(code.target),
    r: toHex(code.rand),
    n: sanitizeName(code.targetName),
  };
  return base64UrlEncode(JSON.stringify(payload));
};

/**
 * @param expectedGame contract address of the game doing the scanning. A code from another game
 * is rejected outright, which is what stops a code being replayed into a different lobby.
 */
export const decodeTagCode = (encoded: string, expectedGame: string): TagCode => {
  if (encoded.length > MAX_ENCODED_LENGTH) {
    throw new TagCodeError("That code is too long to be one of ours", "too-long");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(base64UrlDecode(encoded));
  } catch {
    throw new TagCodeError("That is not a Blindside code", "malformed");
  }

  const result = tagCodeSchema.safeParse(parsed);
  if (!result.success) {
    throw new TagCodeError("That is not a Blindside code", "malformed");
  }
  if (result.data.g !== expectedGame) {
    throw new TagCodeError("That code belongs to a different game", "wrong-game");
  }

  return {
    game: result.data.g,
    tagToken: fromHex(result.data.t),
    target: fromHex(result.data.tg),
    rand: fromHex(result.data.r),
    targetName: sanitizeName(result.data.n),
  };
};

export const toHex = (bytes: Uint8Array): string =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

export const fromHex = (hex: string): Uint8Array => {
  const pairs = hex.match(/.{2}/g) ?? [];
  return new Uint8Array(pairs.map((pair) => Number.parseInt(pair, 16)));
};

const base64UrlEncode = (text: string): string =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const base64UrlDecode = (encoded: string): string => {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  return new TextDecoder().decode(
    Uint8Array.from(binary, (char) => char.charCodeAt(0)),
  );
};
