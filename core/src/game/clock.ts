// How long a game has left, in words rather than a timestamp.
//
// The deadline is fixed when the game is deployed and nobody can move it, which is the whole
// reason it is worth putting on a wall: it is the one number in the game that is not anybody's
// decision.
// SPDX-License-Identifier: Apache-2.0

const MINUTE = 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;

const plural = (count: number, unit: string): string =>
  `${count} ${unit}${count === 1 ? "" : "s"}`;

/** Returns null once the deadline has passed, because that is a different thing to say. */
export const timeLeft = (deadline: bigint, now = Date.now()): string | null => {
  const seconds = Number(deadline) - Math.floor(now / 1000);
  if (seconds <= 0) {
    return null;
  }
  if (seconds >= DAY) {
    const days = Math.floor(seconds / DAY);
    return `${plural(days, "day")}, ${plural(Math.floor((seconds % DAY) / HOUR), "hour")}`;
  }
  if (seconds >= HOUR) {
    const hours = Math.floor(seconds / HOUR);
    return `${plural(hours, "hour")}, ${plural(Math.floor((seconds % HOUR) / MINUTE), "minute")}`;
  }
  if (seconds >= MINUTE) {
    return plural(Math.floor(seconds / MINUTE), "minute");
  }
  return plural(seconds, "second");
};
