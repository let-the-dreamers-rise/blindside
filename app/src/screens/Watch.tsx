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

const REFRESH_MS = 6_000;

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

/**
 * A spectator view of a real game. It holds no secrets and asks for none: everything on this
 * screen came out of a public indexer, which is exactly as much as anybody watching the chain
 * can learn.
 */
export const Watch = () => {
  const [network, setNetwork] = useState<Network>(firstNetwork);
  const [address, setAddress] = useState(addressFromHash);
  const [game, setGame] = useState<PublicGame | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <main>
      <a href="#/" className="mono" style={{ color: "var(--paper-dim)" }}>
        &larr; Blindside
      </a>

      <h1 style={{ marginTop: 18 }}>Watch a live game</h1>
      <p className="lede">
        Point this at a deployed game and it shows you everything the chain knows about it. That
        turns out to be very little.
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

        <button onClick={() => void load()} disabled={loading} style={{ marginTop: 16 }}>
          {loading ? "Reading the chain" : "Watch this game"}
        </button>

        {problem === null ? null : (
          <p className="note" style={{ marginTop: 14 }}>
            {problem}
          </p>
        )}
      </section>

      {game === null ? null : (
        <section className="card" style={{ marginTop: 18 }}>
          <p className="stamp">{phaseLabel(game.phase)}</p>
          <div className="tally" style={{ margin: "18px 0" }}>
            <div>
              <strong>{game.players}</strong>
              joined
            </div>
            <div>
              <strong>{game.alive}</strong>
              still in
            </div>
            <div>
              <strong>{game.tags}</strong>
              tags
            </div>
            <div>
              <strong>{game.pot.toString()}</strong>
              in the pot
            </div>
            <div>
              <strong>{game.leaves}</strong>
              notes
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
            Refreshing every {REFRESH_MS / 1000} seconds. Nothing on this screen came from a
            player: it is all public state, read from the indexer.
          </p>
        </section>
      )}
    </main>
  );
};
