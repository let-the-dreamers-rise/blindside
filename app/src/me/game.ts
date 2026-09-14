// A player's phone, on the night. Everything here is read out of the published bundle with the
// five words the player knows; nothing talks to a server and nothing leaves the device.
// SPDX-License-Identifier: Apache-2.0

import { pureCircuits } from "@blindside/contract";
import {
  type Assignment,
  BundleError,
  type GameKeys,
  type SealedItem,
  type WordCode,
  decodeBundle,
  keysForGame,
  myAssignment,
  readWordCode,
  surrenderFromWords,
  toHex,
  wordCodeText,
} from "@blindside/core";

const PREFIX = "blindside1";

export type MyGame = {
  readonly game: string;
  readonly items: readonly SealedItem[];
  readonly keys: GameKeys;
  readonly assignment: Assignment | null;
};

/** The game address a bundle names, before anything in it is trusted. */
export const gameOf = (bundleText: string): string | null => {
  const parts = bundleText.trim().split(".");
  const game = parts[1];
  return parts.length === 3 && parts[0] === PREFIX && game !== undefined && game !== "" ? game : null;
};

/**
 * Turns the words into keys, the one slow step, and reads your own assignment out of the
 * bundle. Throws a BundleError with a player-facing message when the text is not a bundle.
 */
export const openMyGame = (words: WordCode, bundleText: string): MyGame => {
  const game = gameOf(bundleText);
  if (game === null) {
    throw new BundleError("That is not a Blindside bundle", "malformed");
  }
  const { items } = decodeBundle(bundleText, game);
  const keys = keysForGame(words, game);
  return { game, items, keys, assignment: myAssignment(keys, items) };
};

export type Heard =
  | { readonly kind: "yes"; readonly name: string; readonly said: string }
  | { readonly kind: "not-five" }
  | { readonly kind: "no-target" }
  | { readonly kind: "nothing" }
  | { readonly kind: "not-target"; readonly name: string };

/**
 * What the words you just heard are worth. The check is the same one the contract makes: the
 * words open a tag token, and the player behind it is the one your note points at.
 */
export const checkHeard = (mine: MyGame, spoken: string): Heard => {
  const heard = readWordCode(spoken);
  if (heard === null) {
    return { kind: "not-five" };
  }
  if (mine.assignment === null) {
    return { kind: "no-target" };
  }
  const surrender = surrenderFromWords(heard, mine.game, mine.items);
  if (surrender === null) {
    return { kind: "nothing" };
  }
  const who = toHex(pureCircuits.playerOf(surrender.tagToken));
  return who === toHex(mine.assignment.target)
    ? { kind: "yes", name: mine.assignment.targetName, said: wordCodeText(heard) }
    : { kind: "not-target", name: mine.assignment.targetName };
};

export const explainHeard = (heard: Heard): string => {
  switch (heard.kind) {
    case "yes":
      return `That was ${heard.name}.`;
    case "not-five":
      return "That is not five words from the list. Ask them to say it again, slower.";
    case "no-target":
      return "You are not hunting anybody in this game, so no words can be a tag.";
    case "nothing":
      return "Those words open nothing in this game. A word is wrong, or they are not in this game.";
    case "not-target":
      return `Those words are somebody's, but not ${heard.name}'s. You can only tag your own target.`;
  }
};
