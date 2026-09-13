// Everything that happens after the wallet is ready: deploy a game, fill it, start it, settle
// tags, pay out. Every button here is one transaction on a real chain.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useState } from "react";
import type { BlindsideProviders, WalletContext } from "@blindside/chain";
import { explain } from "@blindside/core";
import { LiveGame, type Ledger } from "../live/game.ts";
import { TypeTheirWords } from "./WordCode.tsx";

const DEFAULT_FEE = "1000000";
const DEFAULT_MINUTES = "120";
const MIN_PLAYERS = 3;

type Props = {
  readonly providers: BlindsideProviders;
  readonly wallet: WalletContext;
};

const MAX_RAW = 300;

/**
 * A contract assertion has a player-facing translation. Anything else is a real failure of the
 * chain, the prover or the network, and the person running a game is better served by what it
 * actually said than by a reassuring sentence that tells them nothing.
 */
const say = (error: unknown): string => {
  const explained = explain(error);
  if (explained.title !== "That did not go through") {
    return `${explained.title}. ${explained.action}`;
  }
  const raw = error instanceof Error ? error.message : String(error ?? "");
  return raw.length === 0
    ? `${explained.title}. ${explained.action}`
    : raw.slice(0, MAX_RAW);
};

export const GameConsole = ({ providers, wallet }: Props) => {
  const [game, setGame] = useState<LiveGame | null>(null);
  const [state, setState] = useState<Ledger | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [fee, setFee] = useState(DEFAULT_FEE);
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const [, setTick] = useState(0);

  const run = useCallback(
    async (label: string, action: () => Promise<string | null>) => {
      setBusy(label);
      setProblem(null);
      try {
        const said = await action();
        setNote(said);
      } catch (error) {
        // Kept in the console as well: a failure here is the chain, the prover or the network,
        // and whoever is running the game may need the whole of it to work out which.
        console.error(`${label} failed`, error);
        setProblem(say(error));
      } finally {
        setBusy(null);
        setTick((value) => value + 1);
      }
    },
    [],
  );

  const refresh = useCallback(
    async (current: LiveGame) => {
      setState(await current.state());
    },
    [],
  );

  const onCreate = useCallback(
    () =>
      void run("Deploying the game", async () => {
        const created = await LiveGame.create(providers, wallet, {
          entryFee: BigInt(fee || "0"),
          minutes: Number(minutes) || 60,
        });
        setGame(created);
        await refresh(created);
        return `Deployed at ${created.address}`;
      }),
    [fee, minutes, providers, refresh, run, wallet],
  );

  const onJoin = useCallback(() => {
    if (game === null || name.trim().length === 0) {
      return;
    }
    const joining = name.trim();
    setName("");
    void run(`Adding ${joining}`, async () => {
      await game.join(joining);
      await refresh(game);
      return `${joining} is in. Their entry fee is in the contract.`;
    });
  }, [game, name, refresh, run]);

  const onStart = useCallback(() => {
    if (game === null) {
      return;
    }
    void run("Starting the game", async () => {
      await game.start();
      await refresh(game);
      return "Started. Send everybody the bundle below.";
    });
  }, [game, refresh, run]);

  const onTag = useCallback(
    (spoken: string) => {
      if (game === null) {
        return;
      }
      void run("Settling the tag", async () => {
        const gone = await game.tagFromWords(spoken);
        await refresh(game);
        return `${gone} is out.`;
      });
    },
    [game, refresh, run],
  );

  const onClaim = useCallback(() => {
    if (game === null) {
      return;
    }
    void run("Paying out", async () => {
      const winner = await game.claim();
      await refresh(game);
      return `${winner} won. The contract paid out.`;
    });
  }, [game, refresh, run]);

  const onCopy = useCallback(() => {
    if (game === null) {
      return;
    }
    void navigator.clipboard?.writeText(game.bundle).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    });
  }, [game]);

  const players = game?.players ?? [];
  const phase = state === null ? 0 : Number(state.phase);
  const alive = state === null ? 0 : Number(state.aliveCount);

  return (
    <>
      {game === null ? (
        <section className="card" style={{ marginTop: 18 }}>
          <h2>Make a game</h2>
          <p className="note">
            The entry fee and the deadline are fixed here and can never be changed, by you or by
            anybody. Every player's fee goes into the contract.
          </p>

          <label htmlFor="fee" style={{ marginTop: 16 }}>
            Entry fee, in the smallest unit
          </label>
          <input
            id="fee"
            className="mono"
            value={fee}
            inputMode="numeric"
            onChange={(event) => setFee(event.target.value.replace(/\D/g, ""))}
          />

          <label htmlFor="minutes" style={{ marginTop: 16 }}>
            How long the game runs, in minutes
          </label>
          <input
            id="minutes"
            className="mono"
            value={minutes}
            inputMode="numeric"
            onChange={(event) => setMinutes(event.target.value.replace(/\D/g, ""))}
          />

          <button disabled={busy !== null} onClick={onCreate} style={{ marginTop: 18 }}>
            {busy ?? "Deploy the game"}
          </button>
        </section>
      ) : (
        <>
          <section className="card" style={{ marginTop: 18 }}>
            <p className="stamp">
              {phase === 0 ? "Taking players" : phase === 1 ? "Running" : "Finished"}
            </p>
            <p className="note" style={{ marginTop: 14 }}>
              Contract address
            </p>
            <div className="chain-row">{game.address}</div>

            <div className="tally" style={{ marginTop: 18 }}>
              <div>
                <strong>{players.length}</strong>
                in the game
              </div>
              <div>
                <strong>{alive}</strong>
                still in
              </div>
              <div>
                <strong>{state === null ? "..." : state.tagCount.toString()}</strong>
                tags
              </div>
              <div>
                <strong>{state === null ? "..." : state.pot.toString()}</strong>
                in the pot
              </div>
            </div>

            <p style={{ marginTop: 18 }}>
              <a href={`#/watch/${game.address}`}>Open the board for this game</a>
            </p>
          </section>

          {phase === 0 ? (
            <section className="card" style={{ marginTop: 18 }}>
              <h2>Who is playing</h2>
              <p className="note">
                Each player is added with their own secret, made here. Adding one is a real
                transaction: their entry fee goes in and their pseudonym is published.
              </p>

              <ul className="feed" style={{ marginTop: 14 }}>
                {players.length === 0 ? <li>Nobody yet.</li> : null}
                {players.map((player) => (
                  <li key={player.name}>{player.name}</li>
                ))}
              </ul>

              <label htmlFor="player" style={{ marginTop: 16 }}>
                Add a player
              </label>
              <input
                id="player"
                value={name}
                autoComplete="off"
                onChange={(event) => setName(event.target.value)}
                disabled={busy !== null}
              />
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
                <button className="ghost" disabled={busy !== null} onClick={onJoin}>
                  {busy ?? "Add them"}
                </button>
                <button
                  disabled={busy !== null || players.length < MIN_PLAYERS}
                  onClick={onStart}
                >
                  {players.length < MIN_PLAYERS
                    ? `${MIN_PLAYERS - players.length} more to start`
                    : "Start the game"}
                </button>
              </div>
            </section>
          ) : null}

          {phase === 1 ? (
            <>
              <section className="card" style={{ marginTop: 18 }}>
                <h2>The bundle</h2>
                <p className="note">
                  Send this to everybody: paste it in the group chat, put it behind a link, read it
                  off a screen. It is entirely ciphertext and padding. It tells anybody who holds it
                  nothing at all, and it is how each player finds their own target.
                </p>
                <div className="chain-row" style={{ marginTop: 14 }}>
                  {game.bundle.slice(0, 64)}...
                </div>
                <button className="ghost" onClick={onCopy} style={{ marginTop: 14 }}>
                  {copied ? "Copied" : `Copy all ${game.bundle.length} characters`}
                </button>
              </section>

              <section className="card" style={{ marginTop: 18 }}>
                <h2>Settle a tag</h2>
                <p className="note">
                  Somebody has been tagged and said their five words. Type what they said. Nothing
                  here knows who they are until the words open something.
                </p>
                <div style={{ marginTop: 14 }}>
                  <TypeTheirWords
                    label="Settle it on chain"
                    busy={busy}
                    problem={null}
                    onSubmit={onTag}
                  />
                </div>

                <details style={{ marginTop: 18 }}>
                  <summary className="mono">
                    this tab is every player at once: show me their words
                  </summary>
                  <p className="note" style={{ marginTop: 10 }}>
                    In a real game each of these lives on one person's phone and is said out loud
                    once. They are here because this console made every player.
                  </p>
                  <table className="receipts" style={{ marginTop: 12 }}>
                    <tbody>
                      {players.map((player, index) => (
                        <tr key={player.name}>
                          <td>{player.name}</td>
                          <td className="mono">
                            {player.out ? "out" : game.wordsOf(index).join(" ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </section>
            </>
          ) : null}

          {phase === 2 ? (
            <section className="card" style={{ marginTop: 18 }}>
              <h2>One left</h2>
              <p>
                The last player proves they are last and the contract pays out. Nobody has to hand
                anybody anything, and nobody could have stopped it.
              </p>
              <button disabled={busy !== null || state?.pot === 0n} onClick={onClaim}>
                {busy ?? (state?.pot === 0n ? "Paid out" : "Pay out the pot")}
              </button>
            </section>
          ) : null}
        </>
      )}

      {note === null ? null : (
        <p className="note" style={{ marginTop: 16 }} aria-live="polite">
          {note}
        </p>
      )}
      {problem === null ? null : (
        <p className="note" style={{ marginTop: 16 }} role="alert">
          {problem}
        </p>
      )}
    </>
  );
};
