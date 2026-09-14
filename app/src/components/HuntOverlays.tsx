// The beginning and the endings, laid over the campus.
// SPDX-License-Identifier: Apache-2.0

import type { Hunt } from "../hunt/useHunt.ts";

const Intro = ({ hunt }: { readonly hunt: Hunt }) => (
  <section className="card">
    <p className="stamp">Eight players</p>
    <h2 style={{ marginTop: 14 }}>One of them is hunting you.</h2>
    <p>
      You are hunting one of them. Open your envelope to find out who, listen for rumours, and get
      to them before your own hunter gets to you. Buildings hide whoever is inside. When you have
      somebody, they say five words and you type what you heard.
    </p>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
      <button type="button" onClick={() => hunt.start(false)}>
        Start the hunt
      </button>
      <button type="button" className="ghost" onClick={() => hunt.start(true)}>
        Practice first
      </button>
    </div>
    <p className="note" style={{ marginTop: 16 }}>
      Practice takes the roofs off and sends your hunter home. Arrow keys or WASD walk, Enter
      tags, or tap the map. Every tag runs the real compiled contract in this tab.
    </p>
  </section>
);

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

const Paid = ({ hunt }: { readonly hunt: Hunt }) => (
  <section className="card">
    <p className="stamp">Paid out</p>
    <h2 style={{ marginTop: 14 }}>The pot is yours.</h2>
    <p>
      {hunt.snapshot.tags} tags, {hunt.snapshot.nullifiers.length} spent notes, and the chain
      still does not know who tagged whom. The organizer never held the money.
    </p>
    <button type="button" className="ghost" onClick={hunt.playAgain}>
      Play again
    </button>
  </section>
);

const Over = ({ hunt }: { readonly hunt: Hunt }) => {
  const name = hunt.winner === null ? "Somebody" : (hunt.names[hunt.winner] ?? "Somebody");
  return (
    <section className="card">
      <p className="stamp">Over</p>
      <h2 style={{ marginTop: 14 }}>{name} was the last one standing.</h2>
      <p>The contract paid them. It did not need anybody's permission, and it could not have paid anybody else.</p>
      <button type="button" className="ghost" onClick={hunt.playAgain}>
        Play again
      </button>
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
    <button type="button" className="ghost" onClick={hunt.playAgain}>
      Play again
    </button>
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
