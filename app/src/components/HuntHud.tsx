// What you need to know while you are on the move, and the buttons for a thumb.
// SPDX-License-Identifier: Apache-2.0

import type { PointerEvent } from "react";
import type { Dir } from "../hunt/grid.ts";
import type { Hunt } from "../hunt/useHunt.ts";

const clock = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const Stamina = ({ now, full, running }: { readonly now: number; readonly full: number; readonly running: boolean }) => (
  <div
    className={`stamina${running ? " running" : ""}`}
    role="progressbar"
    aria-label="Breath"
    aria-valuenow={now}
    aria-valuemin={0}
    aria-valuemax={full}
  >
    <span style={{ width: `${Math.round((now / full) * 100)}%` }} />
  </div>
);

/**
 * Press and hold, for a thumb. The capture keeps the button held while the thumb slides off it;
 * a synthetic event with no real pointer behind it cannot be captured, and does not need to be.
 */
const holding = (on: () => void, off: () => void) => ({
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // No pointer to capture.
    }
    on();
  },
  onPointerUp: off,
  onPointerCancel: off,
});

const Dpad = ({ hold }: { readonly hold: (dir: Dir | null) => void }) => {
  const press = (dir: Dir) => holding(() => hold(dir), () => hold(null));
  return (
    <div className="dpad" aria-label="Walk">
      <span />
      <button type="button" aria-label="Walk up" {...press("up")}>
        <span className="tri up" aria-hidden="true" />
      </button>
      <span />
      <button type="button" aria-label="Walk left" {...press("left")}>
        <span className="tri left" aria-hidden="true" />
      </button>
      <span />
      <button type="button" aria-label="Walk right" {...press("right")}>
        <span className="tri right" aria-hidden="true" />
      </button>
      <span />
      <button type="button" aria-label="Walk down" {...press("down")}>
        <span className="tri down" aria-hidden="true" />
      </button>
      <span />
    </div>
  );
};

const Target = ({ hunt }: { readonly hunt: Hunt }) => {
  if (hunt.facts.youOut) {
    return <span className="stamp">Out</span>;
  }
  if (hunt.targetIndex !== null) {
    return (
      <div>
        <span className="hud-label">Your target</span>
        <strong>{hunt.names[hunt.targetIndex]}</strong>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="ghost"
      onClick={hunt.openEnvelope}
      disabled={hunt.phase !== "playing"}
    >
      Open the envelope
    </button>
  );
};

/**
 * A phone has no arrow keys and no Enter, and a laptop has no pad worth using, so a hint naming
 * the wrong one is a hint that reads as broken. Asked at render rather than stored: a person who
 * picks up a tablet keyboard mid-game gets the other wording on the next tick.
 */
const coarse = (): boolean => window.matchMedia("(pointer: coarse)").matches;

/** One line under the pad, and only the most pressing one. The order below is the priority. */
const hint = (hunt: Hunt, target: string | null): string => {
  if (hunt.facts.youOut) {
    return "You are out. Everyone is visible now.";
  }
  if (hunt.behind) {
    return "Somebody is right behind you. You do not get to know who. Move.";
  }
  if (hunt.exposed) {
    return "You are off the grounds. The crowd has drifted in without you, so there is nobody out here to stand behind, and your hunter keeps being told where you are.";
  }
  if (hunt.hidden) {
    return "You are lost in the crowd. Nobody can pick you out from a distance while you stand here.";
  }
  if (hunt.phase === "moment") {
    return `${target ?? "They"} stopped. Type what you heard, below.`;
  }
  if (target === null) {
    return coarse()
      ? "The pad walks you, and Run is faster and louder. Tap somebody to walk up to them. Open your envelope to learn who you are hunting."
      : "Arrow keys or the pad to walk, shift to run. Tap somebody to walk up to them. Open your envelope to learn who you are hunting.";
  }
  if (hunt.canTag) {
    return coarse() ? `You are next to ${target}. Tag them.` : `You are next to ${target}. Tag them, or press Enter.`;
  }
  return `Find ${target}. Rumours arrive below. Somebody is finding you the same way, and running is loud.`;
};

export const HuntHud = ({ hunt }: { readonly hunt: Hunt }) => {
  const target = hunt.targetIndex === null ? null : (hunt.names[hunt.targetIndex] ?? null);
  return (
    <div className="hud">
      <div className="hud-row">
        <Target hunt={hunt} />
        <div className="hud-clock mono" aria-label="Time left">
          {clock(hunt.secondsLeft)}
        </div>
        <div className="tally hud-tally">
          <div>
            <strong>{hunt.snapshot.alive}</strong>
            still in
          </div>
          <div>
            <strong>{hunt.snapshot.pot.toString()}</strong>
            in the pot
          </div>
        </div>
      </div>
      <div className="hud-row">
        <Dpad hold={hunt.hold} />
        <div className="hud-actions">
          <button type="button" onClick={hunt.beginMoment} disabled={!hunt.canTag}>
            {target === null ? "Tag" : `Tag ${target}`}
          </button>
          <button
            type="button"
            className="ghost run"
            aria-label="Run"
            {...holding(() => hunt.sprint(true), () => hunt.sprint(false))}
          >
            Run
          </button>
          <button
            type="button"
            className="ghost"
            onClick={hunt.toggleChainEye}
            aria-pressed={hunt.chainEye}
          >
            {hunt.chainEye ? "The campus" : "The chain"}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={hunt.toggleMute}
            aria-pressed={hunt.muted}
          >
            {hunt.muted ? "Sound off" : "Sound on"}
          </button>
        </div>
        <div className="hud-breath">
          <span className="hud-label">Breath</span>
          <Stamina now={hunt.stamina} full={hunt.staminaFull} running={hunt.sim.sprinting} />
        </div>
      </div>
      <p className="note hud-hint">{hint(hunt, target)}</p>
    </div>
  );
};
