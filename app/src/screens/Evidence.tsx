// SPDX-License-Identifier: Apache-2.0

import run from "../evidence/chain-run.json";

type Step = {
  readonly label: string;
  readonly seconds: number;
  readonly txId?: string;
  readonly blockHeight?: number;
};

const steps = run.steps as readonly Step[];

// Opening the wallet means catching up on the chain's history, which on a public network takes
// far longer than the game does and is not a cost the game pays twice. Counting it in the
// headline number would say a four player game takes half an hour, which is not what happened.
const SYNC = "wallet ready";
const waitedForTheChain = steps.find((step) => step.label === SYNC)?.seconds ?? 0;
const onChain = steps.reduce(
  (sum, step) => (step.label === SYNC ? sum : sum + step.seconds),
  0,
);

/** Seconds as the shape of the number people actually say out loud. */
const clock = (seconds: number): string => {
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  return minutes === 0 ? `${whole}s` : `${minutes}m ${whole % 60}s`;
};

const shorten = (value: string): string =>
  value.length <= 22 ? value : `${value.slice(0, 12)}…${value.slice(-8)}`;

/** A chain on somebody's laptop and a chain the world can see are not the same claim. */
const onAPublicNetwork = run.network !== "undeployed";

/** The command that produced this file, which depends on where it was produced. */
const ranWith = onAPublicNetwork
  ? `pnpm --filter @blindside/cli public ${run.network}`
  : "pnpm --filter @blindside/cli local";

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
      enough to believe them. This is the output of <code>{ranWith}</code>, which deploys the
      contract{" "}
      {onAPublicNetwork
        ? `to Midnight's public ${run.network} network`
        : "to a Midnight node"}{" "}
      and plays a four player game through it, every step a real zero-knowledge proof.
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
          <strong>{clock(onChain)}</strong>
          of chain time
        </div>
      </div>

      <p className="note" style={{ marginTop: 16 }}>
        {steps.length - 1} transactions, each one proved and waited on until the node called it
        final. Before any of them, the wallet spent {clock(waitedForTheChain)} catching up on the
        chain's history, which is what it costs to open a wallet on a network that has been running
        without you.
      </p>
      <p className="note" style={{ marginTop: 16 }}>
        Contract address on the {run.network} network
      </p>
      <div className="chain-row">{run.contractAddress}</div>
      <p className="note" style={{ marginTop: 14 }}>
        Recorded {new Date(run.recordedAt).toUTCString()}. Reproduce it with{" "}
        {onAPublicNetwork ? null : (
          <>
            <code>pnpm --filter @blindside/cli stack:up</code> then{" "}
          </>
        )}
        <code>{ranWith}</code>
        {onAPublicNetwork
          ? ", once a faucet has funded the address it prints."
          : "."}
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
