// The bundle: one line of text that carries a whole game.
//
// After the organizer starts a game they paste this into the group chat, or drop it in a file,
// or put it behind a link. It is entirely ciphertext and padding. Anybody can hold it; nobody
// can read anything out of it without words they were told. Every player finds their own target
// in it, and a hunter finds their victim's surrender in it, which is why the app needs no server
// of its own to pass anything between people.
// SPDX-License-Identifier: Apache-2.0

import { SEALED_BYTES, type SealedItem } from "./sealed.js";
import { base64UrlDecode, base64UrlEncode } from "../crypto/text.js";

const PREFIX = "blindside1";
const MAX_ITEMS = 64;
const GAME_PATTERN = /^[0-9a-zA-Z]{1,128}$/;

export type GameBundle = {
  readonly game: string;
  readonly items: readonly SealedItem[];
};

export class BundleError extends Error {
  constructor(
    message: string,
    readonly reason: "malformed" | "wrong-game" | "too-long",
  ) {
    super(message);
    this.name = "BundleError";
  }
}

export const encodeBundle = ({ game, items }: GameBundle): string => {
  if (!GAME_PATTERN.test(game)) {
    throw new BundleError("That is not a game address", "malformed");
  }
  if (items.length > MAX_ITEMS) {
    throw new BundleError(`A bundle holds at most ${MAX_ITEMS} items`, "too-long");
  }

  const joined = new Uint8Array(items.length * SEALED_BYTES);
  items.forEach((item, index) => {
    if (item.length !== SEALED_BYTES) {
      throw new BundleError("That is not a sealed item", "malformed");
    }
    joined.set(item, index * SEALED_BYTES);
  });

  return `${PREFIX}.${game}.${base64UrlEncode(joined)}`;
};

/**
 * @param expectedGame the game doing the reading. A bundle from another game is refused outright,
 * which is what stops one being pasted into the wrong lobby and quietly doing nothing.
 */
export const decodeBundle = (text: string, expectedGame: string): GameBundle => {
  const parts = text.trim().split(".");
  const [prefix, game, payload] = parts;

  if (parts.length !== 3 || prefix !== PREFIX || game === undefined || payload === undefined) {
    throw new BundleError("That is not a Blindside bundle", "malformed");
  }
  if (payload.length > MAX_ITEMS * SEALED_BYTES * 2) {
    throw new BundleError("That bundle is too long to be one of ours", "too-long");
  }
  if (game !== expectedGame) {
    throw new BundleError("That bundle belongs to a different game", "wrong-game");
  }

  const bytes = base64UrlDecode(payload);
  if (bytes === null || bytes.length === 0 || bytes.length % SEALED_BYTES !== 0) {
    throw new BundleError("That is not a Blindside bundle", "malformed");
  }

  return {
    game,
    items: Array.from({ length: bytes.length / SEALED_BYTES }, (_, index) =>
      bytes.slice(index * SEALED_BYTES, (index + 1) * SEALED_BYTES),
    ),
  };
};
