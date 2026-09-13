// Players never see an assertion string or a stack trace.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { explain } from "../errors.js";

describe("explaining failures", () => {
  it.each([
    ["failed assert: That is not your target", "Wrong person"],
    ["failed assert: Code out of date", "That is an old note"],
    ["failed assert: That code was already used", "Already used"],
    ["failed assert: This game is full", "Game is full"],
    ["failed assert: The game has already started", "Too late to join"],
    ["failed assert: Only the host can do that", "Organizer only"],
    ["failed assert: The deadline has not passed yet", "Still time on the clock"],
    ["failed assert: Already refunded", "Already refunded"],
  ])("turns %s into something a player can act on", (raw, title) => {
    const explained = explain(new Error(raw));
    expect(explained.title).toBe(title);
    expect(explained.action.length).toBeGreaterThan(0);
  });

  it("falls back without leaking the raw error", () => {
    const explained = explain(new Error("TypeError: undefined is not a function"));
    expect(explained.title).toBe("That did not go through");
    expect(JSON.stringify(explained)).not.toContain("TypeError");
  });

  it("copes with things that are not errors at all", () => {
    expect(explain(undefined).title).toBe("That did not go through");
    expect(explain("boom").title).toBe("That did not go through");
  });
});
