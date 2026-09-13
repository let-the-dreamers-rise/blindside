// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo, useRef, useState } from "react";
import { ChainPanel } from "../components/ChainPanel.tsx";
import { ExitsPanel } from "../components/ExitsPanel.tsx";
import { TypeTheirWords, YourWords } from "../components/WordCode.tsx";
import { SandboxRunner, type Snapshot } from "../sandbox/engine.ts";

const STEPS = [
  "Checking their words",
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
  const [problem, setProblem] = useState<string | null>(null);

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

  const onTag = useCallback(
    async (spoken: string) => {
      // Checked before the theatre starts: wrong words should fail immediately, the way they
      // would if you typed them into a phone and nothing happened.
      const wrong = game.wouldRefuse(spoken);
      if (wrong !== null) {
        setProblem(wrong);
        return;
      }
      setProblem(null);
      await runSteps(() => game.tagYourTarget(spoken));
      setRevealed(false);
      window.setTimeout(() => {
        if (game.botMove()) {
          refresh();
        }
      }, 1400);
    },
    [game, refresh, runSteps],
  );

  const onClaim = useCallback(async () => {
    await runSteps(() => game.claim());
  }, [game, runSteps]);

  // The ways out do not need the proving theatre: what matters is that the pot moves.
  const act = useCallback(
    (action: () => void) => () => {
      action();
      setRevealed(false);
      refresh();
    },
    [refresh],
  );

  const theirWords = useMemo(() => snapshot.theirWords, [snapshot]);

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
          {snapshot.refundsOpen ? (
            <>
              <p className="stamp">Draw</p>
              <h2 style={{ marginTop: 16 }}>Nobody won this one.</h2>
              <p>
                The deadline passed with players still in. Every player who joined can take back
                exactly what they put in, whether they were tagged or not.
              </p>
              <button className="ghost" onClick={() => window.location.reload()}>
                Play again
              </button>
            </>
          ) : snapshot.youWon && !snapshot.claimed ? (
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
                    Only this device can read that name. It was sealed to words only you know,
                    inside a bundle everybody can see.
                  </p>

                  <p style={{ marginTop: 18 }}>
                    Tag them, then ask them for their five words. Say it down a phone if you like:
                    the game does not care where you are.
                  </p>
                  <TypeTheirWords
                    label={`I tagged ${snapshot.yourTarget}`}
                    busy={step === null ? null : (STEPS[step] ?? null)}
                    problem={problem}
                    onSubmit={(spoken) => void onTag(spoken)}
                  />

                  {theirWords === null ? null : (
                    <details style={{ marginTop: 18 }}>
                      <summary className="mono">
                        this is a sandbox: show me what they would say
                      </summary>
                      <p className="mono" style={{ marginTop: 10 }}>
                        {theirWords.join(" ")}
                      </p>
                      <p className="note" style={{ marginTop: 8 }}>
                        In a real game you never see this. You hear it, from them, once.
                      </p>
                    </details>
                  )}
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

              <h2>Your words</h2>
              <p className="note" style={{ marginBottom: 14 }}>
                Five words, yours alone. Saying them is what agreeing to be tagged means.
              </p>
              {snapshot.yourWords === null ? null : (
                <YourWords words={snapshot.yourWords} />
              )}
            </>
          )}
        </section>

        <ChainPanel snapshot={snapshot} />
      </div>

      <div style={{ marginTop: 18 }}>
        <ExitsPanel
          snapshot={snapshot}
          busy={step !== null}
          onQuit={act(() => game.quit())}
          onDeadline={act(() => game.letTheDeadlinePass())}
          onOpenRefunds={act(() => game.openRefunds())}
          onRefundEveryone={act(() => game.refundEveryone())}
        />
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
