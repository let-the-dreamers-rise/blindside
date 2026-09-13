// SPDX-License-Identifier: Apache-2.0

export const Landing = () => (
  <main>
    <p className="stamp">Testnet. No real money.</p>

    <h1>
      Everyone has a target.
      <br />
      Nobody knows who has them.
    </h1>

    <p className="lede">
      Blindside is the tag game your school or office already plays, with two things it has never
      had: a prize pot nobody can run off with, and a target list nobody can leak.
    </p>

    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "28px 0 36px" }}>
      <button onClick={() => { window.location.hash = "#/sandbox"; }}>
        Play a game right now
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
            <div>You are given one target, sealed. Only your phone can open it.</div>
          </li>
          <li>
            <span>03</span>
            <div>Tag them in real life. They show you their code, you scan it, and you inherit their target.</div>
          </li>
          <li>
            <span>04</span>
            <div>Last player standing proves it and the contract pays out. No organizer holds the money.</div>
          </li>
        </ol>
      </section>

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
