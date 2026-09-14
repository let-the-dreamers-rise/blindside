// What you need to know while you are on the move, and the buttons for a thumb.
// SPDX-License-Identifier: Apache-2.0

import type { PointerEvent } from "react";
import type { Dir } from "../hunt/grid.ts";
import type { Hunt } from "../hunt/useHunt.ts";

const clock = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const Dpad = ({ hold }: { readonly hold: (dir: Dir | null) => void }) => {
  const press = (dir: Dir) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      hold(dir);
    },
    onPointerUp: () => hold(null),
    onPointerCancel: () => hold(null),
  });
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
            className="ghost"
            onClick={hunt.toggleMute}
            aria-pressed={hunt.muted}
          >
            {hunt.muted ? "Sound off" : "Sound on"}
          </button>
        </div>
      </div>
      <p className="note hud-hint">
        {hunt.facts.youOut
          ? "You are out. Everyone is visible now."
          : hunt.phase === "moment"
            ? `${target ?? "They"} stopped. Type what you heard, below.`
            : target === null
            ? "Arrow keys or the pad to walk. Tap somebody to walk up to them. Open your envelope to learn who you are hunting."
            : hunt.canTag
              ? `You are next to ${target}. Tag them, or press Enter.`
              : `Find ${target}. Rumours arrive below. Somebody is finding you the same way.`}
      </p>
    </div>
  );
};
