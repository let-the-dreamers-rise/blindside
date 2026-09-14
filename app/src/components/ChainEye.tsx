// The same moment, read off the public record instead of off the campus. It lies over the stage
// so the two views are one button apart: the difference between them is the whole product.
// SPDX-License-Identifier: Apache-2.0

import type { Snapshot } from "../sandbox/engine.ts";

const shorten = (value: string): string => `${value.slice(0, 6)}…${value.slice(-4)}`;

const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many);

/** The line that does the work. Everything above it is evidence for it. */
const verdict = (out: number, total: number, tags: number): string => {
  if (tags === 0) {
    return `Nothing has happened yet that anybody could read. ${total} people joined and staked. That is all of it.`;
  }
  return `${out} of the ${total} ${plural(out, "is", "are")} out, and the count above says so. Which ${out} ${plural(out, "it is", "they are")}, who put ${plural(out, "them", "them")} out, and who is hunting whom are not on this screen, because they are not on the chain.`;
};

type Props = {
  readonly snapshot: Snapshot;
  readonly onClose: () => void;
};

export const ChainEye = ({ snapshot, onClose }: Props) => {
  const total = snapshot.commitments.length;
  const out = Math.max(0, total - snapshot.alive);
  return (
    <div className="chain-eye" role="region" aria-label="What the chain sees">
      <div className="chain-eye-head">
        <p className="stamp">The whole public record</p>
        <button type="button" className="ghost" onClick={onClose}>
          Back to the map
        </button>
      </div>

      <p className="chain-eye-verdict">{verdict(out, total, snapshot.tags)}</p>

      <div className="tally">
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
        The players, as pseudonyms. Not one of these changed when somebody was tagged, and there is
        no row here for who is hunting whom.
      </p>
      <div className="chain-grid" data-testid="chain-players">
        {snapshot.commitments.map((value) => (
          <span className="chain-card" key={value}>
            {shorten(value)}
          </span>
        ))}
      </div>

      <p className="note">
        Notes. A tag retires two and writes one. The tree holds {snapshot.leaves}; these are the
        ones retired, and nothing says which note each one was or who spent it.
      </p>
      <div className="chain-grid" data-testid="chain-spent">
        {snapshot.nullifiers.length === 0 ? (
          <span className="chain-card empty">nothing retired yet</span>
        ) : (
          snapshot.nullifiers.map((value) => (
            <span className="chain-card spent" key={value}>
              {shorten(value)}
            </span>
          ))
        )}
      </div>
    </div>
  );
};
