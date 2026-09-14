// The beginning and the endings, laid over the campus.
// SPDX-License-Identifier: Apache-2.0

import { useState } from "react";
import { PLACES } from "../hunt/places.ts";
import { GAME_SECONDS, SIZES, type Hunt } from "../hunt/useHunt.ts";
import { HOW_IT_WORKS } from "../screens/HuntIntroCopy.tsx";

/** Somebody else can play the same night: same campus, same people, same seed. */
const Again = ({ hunt }: { readonly hunt: Hunt }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(hunt.shareLink()).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    });
  };
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <button type="button" className="ghost" onClick={hunt.playAgain}>
        Play again
      </button>
      <button type="button" className="ghost" onClick={copy}>
        {copied ? "Copied" : "Copy this game's link"}
      </button>
    </div>
  );
};

const HOW_LONG: Readonly<Record<number, string>> = {
  4: "quick",
  8: "the usual",
  12: "a scramble",
};

const Intro = ({ hunt }: { readonly hunt: Hunt }) => {
  const [players, setPlayers] = useState(hunt.size);
  const [where, setWhere] = useState(hunt.place);
  return (
    <section className="card">
      <p className="stamp">{players} players</p>
      <h2 style={{ marginTop: 14 }}>One of them is hunting you.</h2>
      <p>You are hunting one of them. {HOW_IT_WORKS}</p>

      <div className="sizes" role="group" aria-label="How many are playing">
        {SIZES.map((size) => (
          <button
            type="button"
            key={size}
            className={`chip${size === players ? " on" : ""}`}
            aria-pressed={size === players}
            onClick={() => {
              setPlayers(size);
              hunt.preview(size, where);
            }}
          >
            {size}
            <span>{HOW_LONG[size] ?? ""}</span>
          </button>
        ))}
      </div>

      <div className="sizes" role="group" aria-label="Where you are playing">
        {PLACES.map((place) => (
          <button
            type="button"
            key={place.key}
            className={`chip wide${place.key === where.key ? " on" : ""}`}
            aria-pressed={place.key === where.key}
            onClick={() => {
              setWhere(place);
              hunt.preview(players, place);
            }}
          >
            {place.name}
            <span>{place.blurb}</span>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
        <button type="button" onClick={() => hunt.start(false, players, where)}>
          Start the hunt
        </button>
        <button type="button" className="ghost" onClick={() => hunt.start(true, players, where)}>
          Practice first
        </button>
      </div>
      <p className="note" style={{ marginTop: 16 }}>
        Practice takes the roofs off and sends your hunter home.{" "}
        <span className="only-keyboard">Arrow keys or WASD walk, shift runs, Enter tags, or tap</span>
        <span className="only-touch">The pad walks, Run is faster and louder, or tap</span> the
        map. Every tag runs the real compiled contract in this tab.
      </p>
    </section>
  );
};

const Caught = ({ hunt }: { readonly hunt: Hunt }) => {
  const name = hunt.caughtBy === null ? "Somebody" : (hunt.names[hunt.caughtBy] ?? "Somebody");
  return (
    <section className="card">
      <p className="stamp">Tagged</p>
      <h2 style={{ marginTop: 14 }}>{name} got you.</h2>
      <p>
        A fair tag is a fair tag. You say your five words, they type them, and the contract
        records that somebody was tagged. Not that it was you.
      </p>
      <button type="button" onClick={hunt.sayMyWords} disabled={hunt.busy !== null}>
        {hunt.busy ?? "Say my words"}
      </button>
    </section>
  );
};

const Won = ({ hunt }: { readonly hunt: Hunt }) => (
  <section className="card">
    <p className="stamp">Last one standing</p>
    <h2 style={{ marginTop: 14 }}>You won.</h2>
    <p>
      Nobody has to hand you anything. Prove you are the last player and the contract pays the
      address you bound when you joined.
    </p>
    <button type="button" onClick={hunt.claim} disabled={hunt.busy !== null}>
      {hunt.busy ?? "Claim the pot"}
    </button>
  </section>
);

const Scoreboard = ({ hunt }: { readonly hunt: Hunt }) => (
  <div className="tally" style={{ margin: "18px 0" }}>
    <div>
      <strong>{hunt.snapshot.tags}</strong>
      tags in the game
    </div>
    <div>
      <strong>{hunt.snapshot.nullifiers.length}</strong>
      spent notes
    </div>
    <div>
      <strong>{Math.max(0, GAME_SECONDS - hunt.secondsLeft)}s</strong>
      it took
    </div>
  </div>
);

const Paid = ({ hunt }: { readonly hunt: Hunt }) => (
  <section className="card">
    <p className="stamp">Paid out</p>
    <h2 style={{ marginTop: 14 }}>The pot is yours.</h2>
    <Scoreboard hunt={hunt} />
    <p>
      Every one of those tags was a hidden note spent and a new one created. The chain still does
      not know who tagged whom, and the organizer never held the money.
    </p>
    <Again hunt={hunt} />
  </section>
);

const Over = ({ hunt }: { readonly hunt: Hunt }) => {
  const name = hunt.winner === null ? "Somebody" : (hunt.names[hunt.winner] ?? "Somebody");
  return (
    <section className="card">
      <p className="stamp">Over</p>
      <h2 style={{ marginTop: 14 }}>{name} was the last one standing.</h2>
      <Scoreboard hunt={hunt} />
      <p>The contract paid them. It did not need anybody's permission, and it could not have paid anybody else.</p>
      <Again hunt={hunt} />
    </section>
  );
};

const Draw = ({ hunt }: { readonly hunt: Hunt }) => (
  <section className="card">
    <p className="stamp">Draw</p>
    <h2 style={{ marginTop: 14 }}>Time ran out.</h2>
    <p>
      Nobody won, so nobody is paid. Refunds opened at the deadline and every player took back
      exactly what they put in. The pot is {hunt.snapshot.pot.toString()}.
    </p>
    <Again hunt={hunt} />
  </section>
);

export const HuntOverlays = ({ hunt }: { readonly hunt: Hunt }) => {
  switch (hunt.phase) {
    case "intro":
      return <div className="hunt-overlay"><Intro hunt={hunt} /></div>;
    case "caught":
      return <div className="hunt-overlay"><Caught hunt={hunt} /></div>;
    case "won":
      return <div className="hunt-overlay"><Won hunt={hunt} /></div>;
    case "paid":
      return <div className="hunt-overlay"><Paid hunt={hunt} /></div>;
    case "over":
      return <div className="hunt-overlay"><Over hunt={hunt} /></div>;
    case "draw":
      return <div className="hunt-overlay"><Draw hunt={hunt} /></div>;
    case "out":
      return <div className="hunt-banner mono">You are out. Watching the rest.</div>;
    default:
      return null;
  }
};
