// SPDX-License-Identifier: Apache-2.0

import type { Snapshot } from "../sandbox/engine.ts";

type Props = {
  readonly snapshot: Snapshot;
  readonly busy: boolean;
  readonly onQuit: () => void;
  readonly onDeadline: () => void;
  readonly onOpenRefunds: () => void;
  readonly onRefundEveryone: () => void;
};

type Step = {
  readonly key: string;
  readonly label: string;
  readonly hint: string;
  readonly run: () => void;
  readonly done: boolean;
  readonly available: boolean;
};

/**
 * Every real game of this kind breaks the same few ways: somebody refuses to hand over their
 * code, somebody loses their phone, somebody stops playing, the winner never bothers to claim.
 * Each of those is a button here, and each one really runs the contract.
 */
export const ExitsPanel = ({
  snapshot,
  busy,
  onQuit,
  onDeadline,
  onOpenRefunds,
  onRefundEveryone,
}: Props) => {
  const playing = snapshot.phase === "live";
  const everyoneRefunded = snapshot.pot === 0n && snapshot.refundsOpen;

  const steps: readonly Step[] = [
    {
      key: "quit",
      label: "I want out of this game",
      hint: "Leaves a code only your own hunter can use. It costs you the name of your target.",
      run: onQuit,
      done: snapshot.youResigned,
      available: playing && !snapshot.youAreOut,
    },
    {
      key: "deadline",
      label: "Nobody tags anyone again",
      hint: "The game has an end time fixed when it was created. Run the clock past it.",
      run: onDeadline,
      done: snapshot.deadlinePassed,
      available: !snapshot.refundsOpen,
    },
    {
      key: "refunds",
      label: "Open refunds",
      hint: "Anyone can do this once the deadline has passed. The organizer has no say.",
      run: onOpenRefunds,
      done: snapshot.refundsOpen,
      available: snapshot.deadlinePassed && !snapshot.refundsOpen,
    },
    {
      key: "refund",
      label: "Everyone takes their fee back",
      hint: "Exactly what they put in, tagged or not. A refuser can force a draw, never a win.",
      run: onRefundEveryone,
      done: everyoneRefunded,
      available: snapshot.refundsOpen && !everyoneRefunded,
    },
  ];

  return (
    <section className="card">
      <h2>When it goes wrong</h2>
      <p className="note">
        The money is in the contract, so the question that matters is how it gets out again if
        the game falls apart. Press these in order and watch the pot.
      </p>

      <ol className="exits">
        {steps.map((step) => (
          <li key={step.key} data-done={step.done ? "yes" : "no"}>
            <button
              className="ghost"
              onClick={step.run}
              disabled={busy || step.done || !step.available}
            >
              {step.done ? "Done" : step.label}
            </button>
            <span className="note">{step.hint}</span>
          </li>
        ))}
      </ol>

      {everyoneRefunded ? (
        <p className="stamp" style={{ marginTop: 16 }}>
          Pot empty. Nobody lost anything.
        </p>
      ) : null}
    </section>
  );
};
