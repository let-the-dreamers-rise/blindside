// SPDX-License-Identifier: Apache-2.0

import { useEffect } from "react";
import { ChainPanel } from "../components/ChainPanel.tsx";
import { HuntHud } from "../components/HuntHud.tsx";
import { HuntMoment } from "../components/HuntMoment.tsx";
import { HuntOverlays } from "../components/HuntOverlays.tsx";
import { HuntStage } from "../components/HuntStage.tsx";
import { Minimap } from "../components/Minimap.tsx";
import { YourWords } from "../components/WordCode.tsx";
import type { Dir } from "../hunt/grid.ts";
import { YOU } from "../hunt/sim.ts";
import { type Hunt as HuntGame, useHunt } from "../hunt/useHunt.ts";
import "../ui/hunt.css";

const KEYS: Readonly<Record<string, Dir>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

const typing = (event: KeyboardEvent): boolean =>
  event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;

const useKeyboard = (hunt: HuntGame): void => {
  const { hold, sprint, beginMoment, cancelMoment, canTag, phase } = hunt;
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (typing(event)) {
        return;
      }
      if (event.key === "Shift") {
        sprint(true);
        return;
      }
      const dir = KEYS[event.key];
      if (dir !== undefined) {
        event.preventDefault();
        hold(dir);
      } else if ((event.key === "Enter" || event.key === " ") && canTag) {
        event.preventDefault();
        beginMoment();
      } else if (event.key === "Escape" && phase === "moment") {
        cancelMoment();
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        sprint(false);
      }
      if (KEYS[event.key] !== undefined) {
        hold(null);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      hold(null);
      sprint(false);
    };
  }, [hold, sprint, beginMoment, cancelMoment, canTag, phase]);
};

export const Hunt = () => {
  const hunt = useHunt();
  useKeyboard(hunt);
  const you = hunt.sim.actors[YOU];

  return (
    <main className="hunt">
      <a href="#/" className="mono" style={{ color: "var(--paper-dim)" }}>
        &larr; Blindside
      </a>

      <h1 style={{ marginTop: 18 }}>The hunt</h1>
      <p className="lede">
        Eight players on a campus at night. One of them is hunting you. You are hunting one of
        them. Find yours first.
      </p>

      <HuntStage hunt={hunt}>
        <HuntOverlays hunt={hunt} />
      </HuntStage>
      <HuntHud hunt={hunt} />
      <HuntMoment hunt={hunt} />

      <div className="grid two" style={{ marginTop: 18 }}>
        <section className="card">
          <h2>What you saw</h2>
          <div className="saw">
            <Minimap world={hunt.world} you={you?.at ?? null} rumour={hunt.rumourAt} />
            <ul className="feed" aria-label="What you saw">
              {hunt.worldFeed.map((entry) => (
                <li key={entry.id}>{entry.text}</li>
              ))}
            </ul>
          </div>
          <hr style={{ border: 0, borderTop: "1px solid var(--paper-line)", margin: "20px 0" }} />
          <h2>Your words</h2>
          <p className="note" style={{ marginBottom: 14 }}>
            What you say if somebody gets you. Saying them is what agreeing to be tagged means.
          </p>
          {hunt.snapshot.yourWords === null ? (
            <p className="note">You have said them. You are out.</p>
          ) : (
            <YourWords words={hunt.snapshot.yourWords} />
          )}
        </section>

        <ChainPanel snapshot={hunt.snapshot} />
      </div>

      <p className="note" style={{ marginTop: 20 }}>
        Sandbox honesty: every join, tag, claim and refund on this page runs the real compiled
        contract, so every rule and every refusal is the contract's. The campus, the rumours and
        the other seven players are a game about the real one. Proofs and settlement are
        simulated here; on a chain each tag is a zero-knowledge proof.{" "}
        <a href="#/sandbox">The paper version</a> has the same contract and the four ways out.
      </p>
    </main>
  );
};
