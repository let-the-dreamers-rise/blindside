// The sealed items a game is played out of.
//
// Everything a player needs is published to everybody, sealed to a key nobody holds: the key is
// derived on demand from the five words its owner says out loud. Two kinds of item exist, and a
// player's words open exactly their own two:
//
//   assignment  who you are hunting, sealed by the organizer, who cannot open it again
//   tag token   the preimage that proves it is really you, sealed by the player themselves
//
// Together they are a surrender: the whole of what a hunter needs, and useless to anybody who
// does not already hold a note pointing at that player.
//
// Every item is the same length whatever it holds, and games are padded to a fixed number of
// items, so the published bundle says nothing about who is playing or how many.
// SPDX-License-Identifier: Apache-2.0

import { seal, unseal } from "../crypto/box.js";
import { sanitizeName } from "../crypto/text.js";

const KIND_ASSIGNMENT = 1;
const KIND_TAG_TOKEN = 2;

/** Fixed so that an item's length tells nobody which kind it is. */
export const PLAINTEXT_BYTES = 128;
const BYTES_32 = 32;
const MAX_NAME_BYTES = 60;

export type Assignment = {
  readonly target: Uint8Array;
  readonly rand: Uint8Array;
  readonly targetName: string;
  /**
   * Which of this player's notes this is. A player who tags somebody inherits a new target and
   * publishes a later assignment; both end up in the bundle, and the later one is the live one.
   * Without this, order in a shuffled bundle would decide which target a player believes in.
   */
  readonly generation: number;
};

/** Everything a hunter needs from the player they tagged. */
export type Surrender = Assignment & {
  readonly tagToken: Uint8Array;
};

export type SealedItem = Uint8Array;

const truncateUtf8 = (text: string, limit: number): Uint8Array => {
  const encoder = new TextEncoder();
  let candidate = sanitizeName(text);
  for (;;) {
    const bytes = encoder.encode(candidate);
    if (bytes.length <= limit) {
      return bytes;
    }
    candidate = [...candidate].slice(0, -1).join("");
  }
};

const framed = (write: (body: Uint8Array) => void): Uint8Array => {
  const body = new Uint8Array(PLAINTEXT_BYTES);
  write(body);
  return body;
};

export const MAX_GENERATION = 255;
const TARGET_AT = 2;
const RAND_AT = TARGET_AT + BYTES_32;
const NAME_LENGTH_AT = RAND_AT + BYTES_32;
const NAME_AT = NAME_LENGTH_AT + 1;

export const sealAssignment = (
  wordPublicKey: Uint8Array,
  assignment: Assignment,
): SealedItem => {
  if (
    !Number.isInteger(assignment.generation) ||
    assignment.generation < 0 ||
    assignment.generation > MAX_GENERATION
  ) {
    throw new Error(`A generation is 0 to ${MAX_GENERATION}`);
  }
  return seal(
    wordPublicKey,
    framed((body) => {
      const name = truncateUtf8(assignment.targetName, MAX_NAME_BYTES);
      body[0] = KIND_ASSIGNMENT;
      body[1] = assignment.generation;
      body.set(assignment.target.slice(0, BYTES_32), TARGET_AT);
      body.set(assignment.rand.slice(0, BYTES_32), RAND_AT);
      body[NAME_LENGTH_AT] = name.length;
      body.set(name, NAME_AT);
    }),
  );
};

export const sealTagToken = (
  wordPublicKey: Uint8Array,
  tagToken: Uint8Array,
): SealedItem =>
  seal(
    wordPublicKey,
    framed((body) => {
      body[0] = KIND_TAG_TOKEN;
      body.set(tagToken.slice(0, BYTES_32), 1);
    }),
  );

/** ephemeral key, nonce, ciphertext and tag: the same for every item whatever it holds. */
export const SEALED_BYTES = 32 + 24 + PLAINTEXT_BYTES + 16;

/** An item that holds nothing, indistinguishable from one that does. */
export const sealNothing = (rng: (length: number) => Uint8Array): SealedItem =>
  rng(SEALED_BYTES);

type Parts = {
  readonly assignment: Assignment | null;
  readonly tagToken: Uint8Array | null;
};

const readAssignment = (body: Uint8Array): Assignment | null => {
  const nameLength = body[NAME_LENGTH_AT] ?? 0;
  if (nameLength > MAX_NAME_BYTES || NAME_AT + nameLength > body.length) {
    return null;
  }
  return {
    generation: body[1] ?? 0,
    target: body.slice(TARGET_AT, TARGET_AT + BYTES_32),
    rand: body.slice(RAND_AT, RAND_AT + BYTES_32),
    targetName: sanitizeName(
      new TextDecoder().decode(body.slice(NAME_AT, NAME_AT + nameLength)),
    ),
  };
};

/**
 * Trial-opens every item with one secret key and keeps whichever ones open.
 *
 * A player runs this over the whole published bundle: their own items open, and every other
 * item, padding included, is noise to them. Where several assignments open, the latest
 * generation wins, because a player who has tagged somebody has moved on to a new target.
 */
export const openParts = (
  secretKey: Uint8Array,
  items: readonly SealedItem[],
): Parts => {
  let assignment: Assignment | null = null;
  let tagToken: Uint8Array | null = null;

  for (const item of items) {
    const body = unseal(secretKey, item);
    if (body === null || body.length !== PLAINTEXT_BYTES) {
      continue;
    }
    if (body[0] === KIND_ASSIGNMENT) {
      const opened = readAssignment(body);
      if (opened !== null && (assignment === null || opened.generation > assignment.generation)) {
        assignment = opened;
      }
    }
    if (body[0] === KIND_TAG_TOKEN && tagToken === null) {
      tagToken = body.slice(1, 1 + BYTES_32);
    }
  }

  return { assignment, tagToken };
};

/** A surrender needs both halves. One without the other cannot tag anybody. */
export const surrenderFrom = ({ assignment, tagToken }: Parts): Surrender | null =>
  assignment === null || tagToken === null ? null : { ...assignment, tagToken };
