// Every failure a player can hit, in words they can act on. The contract's assertion text is an
// implementation detail; this is the only place it is allowed to leak into the product.
// SPDX-License-Identifier: Apache-2.0

export type PlayerFacingError = {
  readonly title: string;
  readonly detail: string;
  readonly action: string;
};

const FALLBACK: PlayerFacingError = {
  title: "That did not go through",
  detail: "The game did not accept that action.",
  action: "Try again. If it keeps happening, show this screen to your organizer.",
};

const MAP: ReadonlyArray<readonly [RegExp, PlayerFacingError]> = [
  [
    /not your target/i,
    {
      title: "Wrong person",
      detail: "That code belongs to someone who is not your target.",
      action: "Check your target card, then scan again.",
    },
  ],
  [
    /Code out of date/i,
    {
      title: "That code is stale",
      detail: "They tagged someone else after showing you this code, so it no longer works.",
      action: "Ask them to show their code again, freshly.",
    },
  ],
  [
    /already used/i,
    {
      title: "Already used",
      detail: "This code has already been spent.",
      action: "Ask for a fresh code.",
    },
  ],
  [
    /Unknown code/i,
    {
      title: "Not a code from this game",
      detail: "Nothing in this game matches what was scanned.",
      action: "Make sure you are both in the same game, then scan again.",
    },
  ],
  [
    /Already joined/i,
    {
      title: "You are already in",
      detail: "This device has already joined this game.",
      action: "Go to your target card.",
    },
  ],
  [
    /This game is full/i,
    {
      title: "Game is full",
      detail: "Every slot in this game has been taken.",
      action: "Ask your organizer to start another game.",
    },
  ],
  [
    /has already started/i,
    {
      title: "Too late to join",
      detail: "The organizer already started this game.",
      action: "Ask to be added to the next one.",
    },
  ],
  [
    /This game has expired/i,
    {
      title: "This game has expired",
      detail: "The deadline passed before the game started.",
      action: "Everyone can take their entry fee back from the game page.",
    },
  ],
  [
    /three players/i,
    {
      title: "Not enough players",
      detail: "A game needs at least three people.",
      action: "Share the join link and start once a third player is in.",
    },
  ],
  [
    /Only the host/i,
    {
      title: "Organizer only",
      detail: "Only the person who created this game can do that.",
      action: "Ask your organizer to do it.",
    },
  ],
  [
    /last player standing/i,
    {
      title: "Not the winner",
      detail: "The pot goes to the player who is provably last.",
      action: "Check the feed to see how the game ended.",
    },
  ],
  [
    /deadline has not passed/i,
    {
      title: "Still time on the clock",
      detail: "Refunds open when the game's deadline passes.",
      action: "Come back after the deadline shown on the game page.",
    },
  ],
  [
    /Already refunded/i,
    {
      title: "Already refunded",
      detail: "Your entry fee has already been returned.",
      action: "Check your wallet.",
    },
  ],
  [
    /not in this game/i,
    {
      title: "Not your game",
      detail: "This device never joined this game.",
      action: "Switch to the device you joined with, or restore your keycard.",
    },
  ],
  [
    /Refunds are not open/i,
    {
      title: "Refunds are closed",
      detail: "This game is still running.",
      action: "Play on, or wait for the deadline.",
    },
  ],
];

/** Never shows a raw assertion or a stack trace to a player. */
export const explain = (error: unknown): PlayerFacingError => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const match = MAP.find(([pattern]) => pattern.test(message));
  return match?.[1] ?? FALLBACK;
};
