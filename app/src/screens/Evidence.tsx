// SPDX-License-Identifier: Apache-2.0

import run from "../evidence/chain-run.json";

type Step = {
  readonly label: string;
  readonly seconds: number;
  readonly txId?: string;
  readonly blockHeight?: number;
};

const steps = run.steps as readonly Step[];
const total = steps.reduce((sum, step) => sum + step.seconds, 0);

const shorten = (value: string): string =>
  value.length <= 22 ? value : `${value.slice(0, 12)}…${value.slice(-8)}`;

/**
 * The sandbox proves the rules. This page proves the chain: the same contract deployed to a
 * Midnight node, a whole game played through it, and what each step cost in wall-clock time.
 */
export const Evidence = () => (
  <main>
    <a href="#/" className="mono" style={{ color: "var(--paper-dim)" }}>
      &larr; Blindside
    </a>

    <h1 style={{ marginTop: 18 }}>A real game, on a real chain</h1>
    <p className="lede">
      The sandbox runs the contract without a chain, which is enough to show the rules but not
      enough to believe them. This is the output of <code>pnpm --filter @blindside/cli local</code>,
      which deploys the contract to a Midnight node and plays a four player game through it, every
      step a real zero-knowledge proof.
    </p>

    <section className="card" style={{ marginTop: 24 }}>
      <h2>The game</h2>
      <div className="tally" style={{ marginTop: 12 }}>
        <div>
          <strong>{run.players}</strong>
          players
        </div>
        <div>
          <strong>{run.tagCount}</strong>
          tags
        </div>
        <div>
          <strong>{run.entryFee}</strong>
          entry fee each
        </div>
        <div>
          <strong>{run.potAfterPayout}</strong>
          left in the pot
        </div>
        <div>
          <strong>{Math.round(total)}s</strong>
          start to finish
        </div>
      </div>

      <p className="note" style={{ marginTop: 16 }}>
        Contract address on the {run.network} network
      </p>
      <div className="chain-row">{run.contractAddress}</div>
      <p className="note" style={{ marginTop: 14 }}>
        Recorded {new Date(run.recordedAt).toUTCString()}. Reproduce it with{" "}
        <code>pnpm --filter @blindside/cli stack:up</code> then{" "}
        <code>pnpm --filter @blindside/cli local</code>.
      </p>
    </section>

    <section className="card" style={{ marginTop: 18 }}>
      <h2>How the three tags happened</h2>
      <p>
        Nothing was scanned and nothing was passed between two devices. The organizer published one
        line of text, and each tag was somebody saying five words that opened their own half of it.
      </p>
      <div className="tally" style={{ marginTop: 12 }}>
        <div>
          <strong>{run.sealedItems}</strong>
          sealed items published
        </div>
        <div>
          <strong>{run.bundleCharacters.toLocaleString("en-GB")}</strong>
          characters of ciphertext
        </div>
        <div>
          <strong>{run.handover}</strong>
          per tag
        </div>
      </div>
      <p className="note" style={{ marginTop: 16 }}>
        Every item is the same length whatever it holds, and a game publishes a fixed number of
        them whoever is playing, so the bundle says nothing about who is in the game or how many.
      </p>
    </section>

    <section className="card" style={{ marginTop: 18 }}>
      <h2>Every step</h2>
      <p className="note">
        Each row is one transaction: a proof built on this machine, submitted to the node, and
        waited on until the node called it final.
      </p>
      <table className="receipts">
        <thead>
          <tr>
            <th>Step</th>
            <th>Time</th>
            <th>Transaction</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step) => (
            <tr key={step.label}>
              <td>{step.label}</td>
              <td className="mono">{step.seconds.toFixed(1)}s</td>
              <td className="mono">
                {step.txId === undefined ? "-" : shorten(step.txId)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>

    <p className="note" style={{ marginTop: 20 }}>
      Honest about what this is: a standalone Midnight node, indexer and proof server running on
      one machine, which is the same software as the public network but a chain of its own. The
      entry fee and the pot are test tokens. No real money has been at stake at any point.
    </p>
  </main>
);
