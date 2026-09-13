// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo, useRef, useState } from "react";
import { ChainPanel } from "../components/ChainPanel.tsx";
import { TagCodeQR } from "../components/TagCodeQR.tsx";
import { SandboxRunner, type Snapshot } from "../sandbox/engine.ts";

const STEPS = [
  "Checking their code",
  "Proving the tag",
  "Settling",
] as const;

export const Sandbox = () => {
  const runner = useRef<SandboxRunner | null>(null);
  if (runner.current === null) {
    runner.current = new SandboxRunner();
  }
  const game = runner.current;

  const [snapshot, setSnapshot] = useState<Snapshot>(() => game.snapshot());
  const [revealed, setRevealed] = useState(false);
  const [step, setStep] = useState<number | null>(null);

  const refresh = useCallback(() => setSnapshot(game.snapshot()), [game]);

  const runSteps = useCallback(
    async (action: () => void) => {
      for (let index = 0; index < STEPS.length; index += 1) {
        setStep(index);
        await new Promise((resolve) => window.setTimeout(resolve, 420));
      }
      action();
      setStep(null);
      refresh();
    },
    [refresh],
  );

  const onTag = useCallback(async () => {
    await runSteps(() => game.tagYourTarget());
    setRevealed(false);
    window.setTimeout(() => {
      if (game.botMove()) {
        refresh();
      }
    }, 1400);
  }, [game, refresh, runSteps]);

  const onClaim = useCallback(async () => {
    await runSteps(() => game.claim());
  }, [game, runSteps]);

  const code = useMemo(() => game.yourCode(), [game, snapshot]);

  return (
    <main>
      <a href="#/" className="mono" style={{ color: "var(--paper-dim)" }}>
        &larr; Blindside
      </a>

      <h1 style={{ marginTop: 18 }}>Sandbox game</h1>
      <p className="lede">
        Five players, one of them you. Everything below runs the real compiled contract in this
        browser tab.
      </p>

      <div className="grid two" style={{ marginTop: 24 }}>
        <section className="card">
          {snapshot.youWon && !snapshot.claimed ? (
            <>
              <p className="stamp">Last one standing</p>
              <h2 style={{ marginTop: 16 }}>You won.</h2>
              <p>
                Nobody has to hand you anything. Prove you are the last player and the contract
                pays out.
              </p>
              <button onClick={onClaim} disabled={step !== null}>
                Claim the pot
              </button>
            </>
          ) : snapshot.claimed ? (
            <>
              <p className="stamp">Paid out</p>
              <h2 style={{ marginTop: 16 }}>The pot is yours.</h2>
              <p>
                The contract paid the address you bound when you joined. The organizer never held
                the money and could not have redirected it.
              </p>
              <button className="ghost" onClick={() => window.location.reload()}>
                Play again
              </button>
            </>
          ) : snapshot.youAreOut ? (
            <>
              <p className="stamp">Tagged</p>
              <h2 style={{ marginTop: 16 }}>You are out.</h2>
              <p>
                Your hunter inherited your target. The chain recorded that someone was tagged, not
                that it was you.
              </p>
              <button className="ghost" onClick={() => window.location.reload()}>
                Play again
              </button>
            </>
          ) : (
            <>
              <h2>Your target</h2>
              {revealed ? (
                <>
                  <p className="lede" style={{ fontSize: "2rem", margin: "8px 0 4px" }}>
                    {snapshot.yourTarget}
                  </p>
                  <p className="note">
                    Only this device can read that name. It was sealed to your key when the game
                    started.
                  </p>
                  <button
                    onClick={onTag}
                    disabled={step !== null}
                    style={{ marginTop: 16 }}
                  >
                    {step === null
                      ? `I tagged ${snapshot.yourTarget}`
                      : STEPS[step]}
                  </button>
                </>
              ) : (
                <div className="envelope">
                  <p className="mono" style={{ color: "var(--paper-dim)" }}>
                    sealed to your key
                  </p>
                  <button className="ghost" onClick={() => setRevealed(true)}>
                    Open the envelope
                  </button>
                </div>
              )}

              <hr style={{ border: 0, borderTop: "1px solid var(--paper-line)", margin: "24px 0" }} />

              <h2>Your code</h2>
              <p className="note" style={{ marginBottom: 14 }}>
                Show this only when someone has genuinely tagged you.
              </p>
              {code === null ? null : <TagCodeQR value={code} label="tag code" />}
            </>
          )}
        </section>

        <ChainPanel snapshot={snapshot} />
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Feed</h2>
        <ul className="feed">
          {snapshot.feed.map((entry) => (
            <li key={entry.id}>
              {entry.text}
              {entry.detail === undefined ? null : (
                <div className="note" style={{ marginTop: 4, borderLeft: 0, paddingLeft: 0 }}>
                  {entry.detail}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <p className="note" style={{ marginTop: 20 }}>
        Sandbox honesty: this page runs the real compiled contract, so every rule and every refusal
        is real. Proof generation and on-chain settlement are simulated here. In a real game each
        tag is a zero-knowledge proof submitted to Midnight.
      </p>
    </main>
  );
};
