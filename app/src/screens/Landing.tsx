// SPDX-License-Identifier: Apache-2.0

import { CampusStrip } from "../components/CampusStrip.tsx";

export const Landing = () => (
  <main>
    <p className="stamp">Testnet. No real money.</p>

    <h1>
      Everyone has a target.
      <br />
      Nobody knows who has them.
    </h1>

    <p className="lede">
      Blindside is the tag game your school, office or group chat already plays, with two things it
      has never had: a prize pot nobody can run off with, and a target list nobody can leak.
    </p>

    <CampusStrip />

    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "28px 0 36px" }}>
      <button onClick={() => { window.location.hash = "#/hunt"; }}>
        Play the hunt
      </button>
      <button
        className="ghost"
        onClick={() => {
          window.location.hash = "#/evidence";
        }}
      >
        See it on a real chain
      </button>
    </div>

    <div className="grid two">
      <section className="card" id="how">
        <h2>How a game runs</h2>
        <ol className="steps">
          <li>
            <span>01</span>
            <div>Everyone joins with one tap. The entry fee goes into the contract, not to a person.</div>
          </li>
          <li>
            <span>02</span>
            <div>You are given one target, sealed. Only five words you know can open it.</div>
          </li>
          <li>
            <span>03</span>
            <div>
              Get them. They say their five words: in a corridor, down a phone, in a message.
              You type what you heard and you inherit their target.
            </div>
          </li>
          <li>
            <span>04</span>
            <div>Last player standing proves it and the contract pays out. No organizer holds the money.</div>
          </li>
        </ol>
      </section>

      <section className="card">
        <h2>Five words, not a scan</h2>
        <p>
          A tag needs 96 bytes of your target's hidden note. Nobody reads 96 bytes out loud, so the
          bytes are published where everybody can see them and useless to all of them. The key is
          five words, and the only person who can say them is the person being tagged.
        </p>
        <ol className="words">
          <li>
            <span className="mono">1</span>marble
          </li>
          <li>
            <span className="mono">2</span>anchor
          </li>
          <li>
            <span className="mono">3</span>velvet
          </li>
          <li>
            <span className="mono">4</span>ridge
          </li>
          <li>
            <span className="mono">5</span>often
          </li>
        </ol>
        <p className="note" style={{ marginTop: 18 }}>
          Which means a game is not limited to people who can stand next to each other. Overhearing
          the words gets a stranger nothing: a tag also needs your hunter's own secret.
        </p>
      </section>
    </div>

    <div className="grid two" style={{ marginTop: 18 }}>
      <section className="card">
        <h2>What the chain sees</h2>
        <p>
          When you tag someone, the public record gains two spent notes and one new note. It does
          not gain your name, their name, or the link between you.
        </p>
        <div className="chain-row">a41f… spent</div>
        <div className="chain-row">9c07… spent</div>
        <div className="chain-row">+ 1 new note</div>
        <p className="note" style={{ marginTop: 18 }}>
          What this version does not hide: the organizer builds the target list, so the organizer
          knows it. They cannot fake a tag and cannot touch the pot. Removing that is next.
        </p>
        <p style={{ marginTop: 18 }}>
          <a href="#/evidence">A whole game, played on a Midnight node</a>
          <br />
          <a href="#/watch">Watch a live game from the chain alone</a>
          <br />
          <a href="#/sandbox">The paper version: the same contract, and the four ways out</a>
          <br />
          <a href="#/me">Playing in a real game tonight? Your phone</a>
        </p>
      </section>
    </div>

    <section className="card" style={{ marginTop: 18 }}>
      <h2>House rules</h2>
      <p>
        18+. It is a tag, nothing more: no vehicles, no classrooms or labs, no touching anyone who
        says stop, and no location tracking anywhere in the app. Prize pots are testnet only until
        a legal review says otherwise.
      </p>
      <p style={{ marginTop: 14 }}>
        <a href="#/rules">The rules in full, and what an organizer has to tell their players</a>
      </p>
    </section>
  </main>
);
