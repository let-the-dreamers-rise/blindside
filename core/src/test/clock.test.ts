// The one number in a game that nobody gets to move.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { timeLeft } from "../game/clock.js";

const at = (seconds: number): number => seconds * 1000;

describe("time left on the clock", () => {
  it("counts days and hours for a game that runs over a weekend", () => {
    expect(timeLeft(200_000n, at(100_000))).toBe("1 day, 3 hours");
    expect(timeLeft(272_800n, at(100_000))).toBe("2 days, 0 hours");
  });

  it("counts hours and minutes for the last day", () => {
    expect(timeLeft(107_400n, at(100_000))).toBe("2 hours, 3 minutes");
    expect(timeLeft(103_600n, at(100_000))).toBe("1 hour, 0 minutes");
  });

  it("counts minutes, then seconds, as it runs out", () => {
    expect(timeLeft(100_600n, at(100_000))).toBe("10 minutes");
    expect(timeLeft(100_060n, at(100_000))).toBe("1 minute");
    expect(timeLeft(100_030n, at(100_000))).toBe("30 seconds");
    expect(timeLeft(100_001n, at(100_000))).toBe("1 second");
  });

  it("says nothing rather than a negative number once it has passed", () => {
    expect(timeLeft(100_000n, at(100_000))).toBeNull();
    expect(timeLeft(99_999n, at(100_000))).toBeNull();
    expect(timeLeft(0n, at(100_000))).toBeNull();
  });
});
