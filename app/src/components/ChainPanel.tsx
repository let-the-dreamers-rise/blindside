// SPDX-License-Identifier: Apache-2.0

import type { Snapshot } from "../sandbox/engine.ts";

const shorten = (value: string): string => `${value.slice(0, 8)}…${value.slice(-6)}`;

type Props = {
  readonly snapshot: Snapshot;
};

/** The other half of the pitch: what an observer can read, side by side with what you see. */
export const ChainPanel = ({ snapshot }: Props) => (
  <section className="card">
    <h2>What the chain sees</h2>

    <div className="tally" style={{ marginBottom: 16 }}>
      <div>
        <strong>{snapshot.alive}</strong>
        still in
      </div>
      <div>
        <strong>{snapshot.tags}</strong>
        tags
      </div>
      <div>
        <strong>{snapshot.pot.toString()}</strong>
        in the pot
      </div>
      <div>
        <strong>{snapshot.leaves}</strong>
        notes
      </div>
    </div>

    <p className="note">
      Spent notes. Each tag retires two and creates one. None of them can be traced back to a
      person or to the note it replaced.
    </p>

    <div style={{ margin: "12px 0 16px" }}>
      {snapshot.nullifiers.length === 0 ? (
        <div className="chain-row">nothing spent yet</div>
      ) : (
        snapshot.nullifiers.map((value) => (
          <div className="chain-row" key={value}>
            {shorten(value)} spent
          </div>
        ))
      )}
    </div>

    <p className="note">
      Players, as pseudonyms. This list never changes when someone is tagged, so being out is not
      public either.
    </p>
    <div style={{ marginTop: 12 }}>
      {snapshot.commitments.map((value) => (
        <div className="chain-row" key={value}>
          {shorten(value)}
        </div>
      ))}
    </div>
  </section>
);
