// SPDX-License-Identifier: Apache-2.0

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { readWordCode, wordCodeText } from "@blindside/core";
import { TypeTheirWords, YourWords } from "../components/WordCode.tsx";
import { type Heard, type MyGame, checkHeard, explainHeard, openMyGame } from "../me/game.ts";
import { EMPTY_ME, type Me as Kept, forgetMe, loadMe, saveMe } from "../me/store.ts";

const shorten = (value: string): string =>
  value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;

/** Lets the page paint before a second of Argon2id freezes it. */
const afterPaint = (work: () => void): (() => void) => {
  const timer = window.setTimeout(work, 30);
  return () => window.clearTimeout(timer);
};

type WordsProps = {
  readonly kept: string;
  readonly onKeep: (words: string) => string | null;
  readonly onForget: () => void;
};

const MyWords = ({ kept, onKeep, onForget }: WordsProps) => {
  const [draft, setDraft] = useState(kept);
  const [problem, setProblem] = useState<string | null>(null);
  const code = useMemo(() => readWordCode(kept), [kept]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setProblem(onKeep(draft));
  };

  return (
    <section className="card">
      <h2>Your words</h2>
      {code === null ? (
        <form onSubmit={submit}>
          <p className="note" style={{ marginBottom: 14 }}>
            The organizer gave you five words. They are what you say if somebody gets you, and
            the only key to your part of the game. They stay on this phone.
          </p>
          <label htmlFor="my-words">The five words you were given</label>
          <input
            id="my-words"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="five words"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          {problem === null ? null : (
            <p className="note" style={{ marginTop: 12 }} role="alert">
              {problem}
            </p>
          )}
          <button type="submit" style={{ marginTop: 14 }}>
            Keep them on this phone
          </button>
        </form>
      ) : (
        <>
          <p className="note" style={{ marginBottom: 14 }}>
            Say these only to somebody who has genuinely tagged you.
          </p>
          <YourWords words={[...code]} />
          <button type="button" className="ghost" onClick={onForget} style={{ marginTop: 16 }}>
            Forget everything on this phone
          </button>
        </>
      )}
    </section>
  );
};

type BundleProps = {
  readonly kept: string;
  readonly ready: boolean;
  readonly onRead: (bundle: string) => void;
};

const TheBundle = ({ kept, ready, onRead }: BundleProps) => {
  const [draft, setDraft] = useState(kept);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onRead(draft);
  };
  return (
    <section className="card">
      <h2>The game</h2>
      <form onSubmit={submit}>
        <p className="note" style={{ marginBottom: 14 }}>
          When the game starts the organizer posts one line of text, the bundle. Paste it here.
          It is ciphertext: everybody has it, and your words open only your part.
        </p>
        <label htmlFor="bundle">The bundle from the group chat</label>
        <textarea
          id="bundle"
          className="mono"
          rows={4}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="blindside1."
          spellCheck={false}
        />
        <button type="submit" style={{ marginTop: 14 }} disabled={!ready}>
          {ready ? "Read it" : "Keep your words first"}
        </button>
      </form>
    </section>
  );
};

type TargetProps = { readonly mine: MyGame; readonly working: boolean };

const Working = () => (
  <section className="card">
    <p className="mono" style={{ color: "var(--paper-dim)" }}>
      Turning your words into a key. About a second.
    </p>
  </section>
);

const MyTarget = ({ mine, working }: TargetProps) => {
  const [revealed, setRevealed] = useState(false);
  const [heard, setHeard] = useState<Heard | null>(null);
  const [checking, setChecking] = useState(false);

  const check = (spoken: string) => {
    setChecking(true);
    afterPaint(() => {
      setHeard(checkHeard(mine, spoken));
      setChecking(false);
    });
  };

  if (working) {
    return <Working />;
  }
  return (
    <section className="card">
      <p className="mono" style={{ color: "var(--paper-dim)", marginBottom: 12 }}>
        game {shorten(mine.game)}, {mine.items.length} sealed items
      </p>
      <h2>Your target</h2>
      {mine.assignment === null ? (
        <p className="note">
          Your words open nothing in this bundle. Wrong words, a bundle from another game, or the
          organizer has not started this one yet.
        </p>
      ) : revealed ? (
        <>
          <p className="lede" style={{ fontSize: "2rem", margin: "8px 0 4px" }}>
            {mine.assignment.targetName}
          </p>
          <p className="note">Only this phone can read that name. Nobody else's words open it.</p>
          <hr style={{ border: 0, borderTop: "1px solid var(--paper-line)", margin: "22px 0" }} />
          <h2>You got them?</h2>
          <p>
            They say their five words. Check them here before you walk to the organizer, so you
            know the tag is real before anybody settles anything.
          </p>
          <TypeTheirWords
            label="Check what I heard"
            busy={checking ? "Checking" : null}
            problem={heard === null || heard.kind === "yes" ? null : explainHeard(heard)}
            onSubmit={check}
          />
          {heard?.kind === "yes" ? (
            <div style={{ marginTop: 18 }} role="status">
              <p className="stamp">Tagged</p>
              <p style={{ marginTop: 12 }}>
                {explainHeard(heard)} Give the organizer these five words and they settle it on
                chain. Then their target is yours.
              </p>
              <p className="mono">{heard.said}</p>
            </div>
          ) : null}
        </>
      ) : (
        <div className="envelope">
          <p className="mono" style={{ color: "var(--paper-dim)" }}>
            sealed to your words
          </p>
          <button type="button" className="ghost" onClick={() => setRevealed(true)}>
            Open the envelope
          </button>
        </div>
      )}
    </section>
  );
};

export const Me = () => {
  const [kept, setKept] = useState<Kept>(loadMe);
  const [mine, setMine] = useState<MyGame | null>(null);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const words = useMemo(() => readWordCode(kept.words), [kept.words]);

  useEffect(() => {
    if (words === null || kept.bundle === "") {
      setMine(null);
      return;
    }
    setWorking(true);
    setProblem(null);
    return afterPaint(() => {
      try {
        setMine(openMyGame(words, kept.bundle));
      } catch (error) {
        setMine(null);
        setProblem(error instanceof Error ? error.message : "That bundle could not be read");
      }
      setWorking(false);
    });
  }, [words, kept.bundle]);

  const keep = (next: Kept) => {
    setKept(next);
    saveMe(next);
  };

  const onKeepWords = (draft: string): string | null => {
    const code = readWordCode(draft);
    if (code === null) {
      return "That is not five words from the list.";
    }
    keep({ ...kept, words: wordCodeText(code) });
    return null;
  };

  const onForget = () => {
    forgetMe();
    setKept(EMPTY_ME);
    setMine(null);
    setProblem(null);
  };

  return (
    <main>
      <a href="#/" className="mono" style={{ color: "var(--paper-dim)" }}>
        &larr; Blindside
      </a>
      <h1 style={{ marginTop: 18 }}>Your phone</h1>
      <p className="lede">
        What a player needs on the night. Your target, read out of the bundle. Your five words,
        if somebody gets you. A check on the words you heard, before you walk to the organizer.
        Nothing on this page talks to anybody.
      </p>

      <div className="grid two" style={{ marginTop: 24 }}>
        <MyWords kept={kept.words} onKeep={onKeepWords} onForget={onForget} />
        <TheBundle
          kept={kept.bundle}
          ready={words !== null}
          onRead={(bundle) => keep({ ...kept, bundle: bundle.trim() })}
        />
      </div>

      {problem === null ? null : (
        <p className="note" style={{ marginTop: 18 }} role="alert">
          {problem}
        </p>
      )}

      {working ? (
        <div style={{ marginTop: 18 }}>
          <Working />
        </div>
      ) : mine === null ? null : (
        <div style={{ marginTop: 18 }}>
          <MyTarget key={`${mine.game}:${mine.items.length}`} mine={mine} working={false} />
        </div>
      )}

      <p className="note" style={{ marginTop: 20 }}>
        Why the organizer settles it: proving a tag on Midnight needs a proof server, which a
        phone does not have yet, so in this version the <a href="#/live">console</a> holds each
        player's proving secret and submits the transaction. It cannot invent a tag: the words you
        relay are the only thing that opens your target's half, and the contract checks them.
        Proving from the phone itself is the next milestone.
      </p>
    </main>
  );
};
