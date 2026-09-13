// Signing unshielded inputs on a transaction the wallet built for us.
// Adapted from midnightntwrk/example-counter (Apache-2.0).
// SPDX-License-Identifier: Apache-2.0

import * as ledger from "@midnight-ntwrk/ledger-v8";

type AnyIntent = ledger.Intent<
  ledger.SignatureEnabled,
  ledger.Proofish,
  ledger.PreBinding
>;

export type SignableTransaction = {
  intents?: Map<number, AnyIntent> | undefined;
};

export type SignData = (payload: Uint8Array) => ledger.Signature;

/**
 * The wallet hardcodes 'pre-proof' when it clones an intent, which throws for an intent that has
 * already been proven. So we clone it ourselves with the right marker.
 */
const cloneIntent = (
  intent: AnyIntent,
  proofMarker: "proof" | "pre-proof",
): AnyIntent =>
  ledger.Intent.deserialize<
    ledger.SignatureEnabled,
    ledger.Proofish,
    ledger.PreBinding
  >("signature", proofMarker, "pre-binding", intent.serialize());

/** Fills every unsigned input in an offer with `signature`, leaving signed ones alone. */
const withSignatures = <S extends ledger.Signaturish>(
  offer: ledger.UnshieldedOffer<S> | undefined,
  signature: ledger.Signature,
): ledger.UnshieldedOffer<S> | undefined =>
  offer?.addSignatures(
    offer.inputs.map(
      (_: ledger.UtxoSpend, index: number) =>
        offer.signatures.at(index) ?? signature,
    ),
  );

const signIntent = (
  intent: AnyIntent,
  segment: number,
  signData: SignData,
  proofMarker: "proof" | "pre-proof",
): AnyIntent => {
  const signed = cloneIntent(intent, proofMarker);
  const signature = signData(signed.signatureData(segment));
  signed.guaranteedUnshieldedOffer = withSignatures(
    signed.guaranteedUnshieldedOffer,
    signature,
  );
  signed.fallibleUnshieldedOffer = withSignatures(
    signed.fallibleUnshieldedOffer,
    signature,
  );
  return signed;
};

/**
 * Signs the unshielded inputs of every intent on `tx`, in place.
 *
 * The intents accessor hands back a fresh Map on every read, so the signed intents have to be
 * assigned back to the transaction or they are silently dropped and the node rejects the
 * transaction as malformed with inputs but no signatures.
 */
export const signTransactionIntents = (
  tx: SignableTransaction,
  signData: SignData,
  proofMarker: "proof" | "pre-proof",
): void => {
  const intents = tx.intents;
  if (intents === undefined || intents.size === 0) {
    return;
  }

  tx.intents = new Map(
    [...intents.entries()].map(([segment, intent]) => [
      segment,
      signIntent(intent, segment, signData, proofMarker),
    ]),
  );
};
