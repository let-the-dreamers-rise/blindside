// The board a group leaves open on a second screen while a game is running.
//
// Everything here came out of a public indexer, which is the point: it is exactly as much as
// anybody watching the chain can learn, and it is almost nothing. What makes it worth watching is
// what it cannot tell you.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useState } from "react";
import {
  NETWORKS,
  type Network,
  type PublicGame,
  looksLikeAddress,
  phaseLabel,
  readGame,
} from "../watch/chain.ts";
import { timeLeft } from "@blindside/core";

const REFRESH_MS = 6_000;
const LIVE = 1;

const shorten = (value: string): string => `${value.slice(0, 8)}…${value.slice(-6)}`;

const addressFromHash = (): string => {
  const parts = window.location.hash.split("/");
  const last = parts[parts.length - 1] ?? "";
  return looksLikeAddress(last) ? last : "";
};

const firstNetwork = (): Network => {
  const network = NETWORKS[0];
  if (network === undefined) {
    throw new Error("no networks configured");
  }
  return network;
};

/** What a watcher can honestly be told, which is less than they will want. */
const readTheRoom = (game: PublicGame): string => {
  if (game.phase !== LIVE) {
    return "";
  }
  if (game.tags === 0) {
    return "Nobody has been tagged yet. Everyone is still somebody's target.";
  }
  if (game.alive === 2) {
    return "Two left. Each of them is hunting the other, and neither has been told.";
  }
  return `${game.tags === 1 ? "One person" : `${game.tags} people`} gone. Whoever was hunting them is hunting somebody new now, and nothing on this page says who.`;
};

export const Watch = () => {
  const [network, setNetwork] = useState<Network>(firstNetwork);
  const [address, setAddress] = useState(addressFromHash);
  const [game, setGame] = useState<PublicGame | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!looksLikeAddress(address)) {
      setProblem("A contract address is 64 hex characters.");
      return;
    }
    setLoading(true);
    try {
      const next = await readGame(network, address);
      if (next === null) {
        setProblem("No contract at that address on this network.");
        setGame(null);
      } else {
        setProblem(null);
        setGame(next);
      }
    } catch {
      setProblem("Could not reach that indexer. Is the chain running?");
      setGame(null);
    } finally {
      setLoading(false);
    }
  }, [address, network]);

  useEffect(() => {
    if (game === null) {
      return;
    }
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [game, load]);

  // The clock has to move even when the chain has nothing new to say.
  useEffect(() => {
    if (game === null) {
      return;
    }
    const timer = window.setInterval(() => setTick((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, [game]);

  const onCopy = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}#/watch/${address.trim().toLowerCase()}`;
    void navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    });
  }, [address]);

  const remaining = game === null ? null : timeLeft(game.deadline);

  return (
    <main>
      <a href="#/" className="mono" style={{ color: "var(--paper-dim)" }}>
        &larr; Blindside
      </a>

      <h1 style={{ marginTop: 18 }}>The board</h1>
      <p className="lede">
        Point this at a live game and it shows you everything the chain knows. Leave it on a second
        screen: the numbers move on their own, and the interesting part is what is missing from
        them.
      </p>

      <section className="card" style={{ marginTop: 24 }}>
        <label htmlFor="network">Network</label>
        <select
          id="network"
          value={network.id}
          onChange={(event) => {
            const found = NETWORKS.find((item) => item.id === event.target.value);
            if (found !== undefined) {
              setNetwork(found);
            }
          }}
        >
          {NETWORKS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>

        <label htmlFor="address" style={{ marginTop: 16 }}>
          Contract address
        </label>
        <input
          id="address"
          className="mono"
          value={address}
          spellCheck={false}
          autoCapitalize="none"
          placeholder="64 hex characters"
          onChange={(event) => setAddress(event.target.value)}
        />

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
          <button onClick={() => void load()} disabled={loading}>
            {loading ? "Reading the chain" : "Watch this game"}
          </button>
          {game === null ? null : (
            <button className="ghost" onClick={onCopy}>
              {copied ? "Copied" : "Copy the link to this board"}
            </button>
          )}
        </div>

        {problem === null ? null : (
          <p className="note" style={{ marginTop: 14 }}>
            {problem}
          </p>
        )}
      </section>

      {game === null ? null : (
        <>
          <section className="card" style={{ marginTop: 18 }}>
            <p className="stamp">{phaseLabel(game.phase)}</p>

            <div className="tally" style={{ margin: "18px 0" }}>
              <div>
                <strong>{game.alive}</strong>
                still in
              </div>
              <div>
                <strong>{game.tags}</strong>
                tagged
              </div>
              <div>
                <strong>{game.pot.toString()}</strong>
                in the pot
              </div>
              <div>
                <strong>{remaining ?? "none"}</strong>
                {remaining === null ? "time left" : "on the clock"}
              </div>
            </div>

            {game.phase === LIVE ? (
              <p className="lede" style={{ fontSize: "1.35rem", marginBottom: 0 }}>
                {readTheRoom(game)}
              </p>
            ) : null}

            {remaining === null && game.pot > 0n ? (
              <p className="note" style={{ marginTop: 18 }}>
                The deadline has passed with money still in the pot. Anybody at all can open
                refunds now, and then every player who joined takes back exactly what they put in.
              </p>
            ) : null}
          </section>

          <section className="card" style={{ marginTop: 18 }}>
            <h2>What this page cannot tell you</h2>
            <ul className="feed">
              <li>Who was tagged. The count went down; no name went with it.</li>
              <li>Who did the tagging. Two notes were spent and neither points at a person.</li>
              <li>Who is hunting whom, now or at the start.</li>
              <li>Whether the person hunting you is still in the game.</li>
            </ul>
            <p className="note" style={{ marginTop: 16 }}>
              That is not a gap in this page. It is the whole of what a Midnight node holds about
              this game, read back out of a public indexer with no wallet and no permission.
            </p>
          </section>

          <details className="card" style={{ marginTop: 18 }}>
            <summary>
              <strong>The raw state</strong>
            </summary>

            <div className="tally" style={{ margin: "18px 0" }}>
              <div>
                <strong>{game.players}</strong>
                joined
              </div>
              <div>
                <strong>{game.entryFee.toString()}</strong>
                entry fee
              </div>
              <div>
                <strong>{game.leaves}</strong>
                notes
              </div>
              <div>
                <strong>{game.deadDrops}</strong>
                dead drops
              </div>
            </div>

            <p className="note">
              Spent notes. Two per tag, and nothing ties one back to the note it retired or to the
              person who spent it.
            </p>
            <div style={{ margin: "12px 0 16px" }}>
              {game.spent.length === 0 ? (
                <div className="chain-row">nothing spent yet</div>
              ) : (
                game.spent.map((value) => (
                  <div className="chain-row" key={value}>
                    {shorten(value)} spent
                  </div>
                ))
              )}
            </div>

            <p className="note">Players, as pseudonyms. Being tagged does not change this list.</p>
            <div style={{ marginTop: 12 }}>
              {game.commitments.map((value) => (
                <div className="chain-row" key={value}>
                  {shorten(value)}
                </div>
              ))}
            </div>

            <p className="note" style={{ marginTop: 18 }}>
              Refreshing every {REFRESH_MS / 1000} seconds.
            </p>
          </details>
        </>
      )}
    </main>
  );
};
