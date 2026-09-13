// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ChainNetwork,
  GENESIS_MINT_WALLET_SEED,
  NETWORKS,
  type WalletBalances,
  type WalletContext,
  balances,
  newSeed,
  openWallet,
  registerForDust,
  useNetwork,
} from "@blindside/chain";
import { rememberSeed, storedSeed } from "../live/seed-store.ts";

const firstNetwork = (): ChainNetwork => {
  const network = NETWORKS[0];
  if (network === undefined) {
    throw new Error("no networks configured");
  }
  return network;
};

const format = (value: bigint): string => value.toLocaleString("en-GB");

/**
 * The console for whoever is running a game. It holds a wallet made here in the tab, because a
 * game wallet holds test tokens and nothing else, and because there is no field in this app that
 * asks anybody for a seed phrase.
 */
export const Live = () => {
  const [network, setNetwork] = useState<ChainNetwork>(firstNetwork);
  const [wallet, setWallet] = useState<WalletContext | null>(null);
  const [funds, setFunds] = useState<WalletBalances | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const subscription = useRef<{ unsubscribe: () => void } | null>(null);

  useEffect(
    () => () => {
      subscription.current?.unsubscribe();
    },
    [],
  );

  const connect = useCallback(
    async (seed: string) => {
      setBusy("Opening the wallet");
      setProblem(null);
      try {
        useNetwork(network);
        rememberSeed(network.id, seed);
        const opened = await openWallet(network, seed);
        subscription.current?.unsubscribe();
        subscription.current = balances(opened.wallet).subscribe(setFunds);
        setWallet(opened);
      } catch (error) {
        setProblem(
          error instanceof Error && error.message.length > 0
            ? error.message
            : "The wallet could not start. Is the chain reachable?",
        );
      } finally {
        setBusy(null);
      }
    },
    [network],
  );

  const onRegister = useCallback(async () => {
    if (wallet === null) {
      return;
    }
    setBusy("Registering for fees");
    setProblem(null);
    try {
      const submitted = await registerForDust(wallet);
      if (!submitted) {
        setProblem("Nothing to register: either fees are ready, or no tokens have arrived yet.");
      }
    } catch {
      setProblem("The registration did not go through. There may be no tokens in the wallet yet.");
    } finally {
      setBusy(null);
    }
  }, [wallet]);

  const onCopy = useCallback(() => {
    if (wallet === null) {
      return;
    }
    void navigator.clipboard?.writeText(wallet.address).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    });
  }, [wallet]);

  const existing = storedSeed(network.id);
  const isLocal = network.faucet === null;

  return (
    <main>
      <a href="#/" className="mono" style={{ color: "var(--paper-dim)" }}>
        &larr; Blindside
      </a>

      <h1 style={{ marginTop: 18 }}>Run a game</h1>
      <p className="lede">
        This is the console for whoever is hosting. It talks to a real Midnight chain from this
        tab: no server in between, and no wallet extension to install.
      </p>

      <section className="card" style={{ marginTop: 24 }}>
        <h2>Chain</h2>
        <label htmlFor="network">Which chain</label>
        <select
          id="network"
          value={network.id}
          disabled={wallet !== null}
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

        <p className="note" style={{ marginTop: 16 }}>
          Proving happens on a proof server at {network.proofServer}, which is yours. Proofs need
          the private inputs, so that is not a job to hand to somebody else's machine.
        </p>

        {wallet === null ? (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
            <button disabled={busy !== null} onClick={() => void connect(existing ?? newSeed())}>
              {busy ?? (existing === null ? "Make a game wallet" : "Open my game wallet")}
            </button>
            {isLocal ? (
              <button
                className="ghost"
                disabled={busy !== null}
                onClick={() => void connect(GENESIS_MINT_WALLET_SEED)}
              >
                Use the local genesis wallet
              </button>
            ) : null}
          </div>
        ) : null}

        {problem === null ? null : (
          <p className="note" style={{ marginTop: 14 }}>
            {problem}
          </p>
        )}
      </section>

      {wallet === null ? null : (
        <section className="card" style={{ marginTop: 18 }}>
          <h2>Wallet</h2>
          <p className="note">This address is a public key. Nothing secret is ever shown here.</p>
          <div className="chain-row">{wallet.address}</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
            <button className="ghost" onClick={onCopy}>
              {copied ? "Copied" : "Copy address"}
            </button>
            {network.faucet === null ? null : (
              <a className="button-link" href={network.faucet} target="_blank" rel="noreferrer">
                Open the faucet
              </a>
            )}
          </div>

          <div className="tally" style={{ marginTop: 20 }}>
            <div>
              <strong>{funds === null ? "..." : format(funds.night)}</strong>
              tNIGHT
            </div>
            <div>
              <strong>{funds === null ? "..." : format(funds.dust)}</strong>
              DUST for fees
            </div>
            <div>
              <strong>{funds?.synced === true ? "yes" : "catching up"}</strong>
              in step with the chain
            </div>
          </div>

          {funds !== null && funds.night > 0n && funds.dust === 0n ? (
            <>
              <p className="note" style={{ marginTop: 18 }}>
                Tokens have arrived but they do not pay fees yet. Registering them starts DUST
                generating, which takes a few minutes.
              </p>
              <button disabled={busy !== null} onClick={() => void onRegister()} style={{ marginTop: 12 }}>
                {busy ?? "Turn tokens into fees"}
              </button>
            </>
          ) : null}

          {funds !== null && funds.night === 0n ? (
            <p className="note" style={{ marginTop: 18 }}>
              No tokens yet. Copy the address above into the faucet, then wait a minute.
            </p>
          ) : null}

          {funds !== null && funds.dust > 0n ? (
            <p className="stamp" style={{ marginTop: 18 }}>
              Ready to deploy a game
            </p>
          ) : null}
        </section>
      )}
    </main>
  );
};
