// The tag itself. They stop, they say five words once, you type what you heard.
// SPDX-License-Identifier: Apache-2.0

import type { Hunt } from "../hunt/useHunt.ts";
import { TypeTheirWords } from "./WordCode.tsx";

export const HuntMoment = ({ hunt }: { readonly hunt: Hunt }) => {
  const moment = hunt.moment;
  if (moment === null || hunt.targetIndex === null) {
    return null;
  }
  const name = hunt.names[hunt.targetIndex] ?? "They";
  return (
    <section className="card moment" aria-live="polite">
      <p className="stamp">The moment</p>
      <h2 style={{ marginTop: 14 }}>{name} stops.</h2>
      <p>
        {moment.heard
          ? "They have said their five words. If you missed one, ask."
          : "They say five words, once. Listen."}{" "}
        Type what you heard. The contract decides whether it was really them, not this page.
      </p>
      <TypeTheirWords
        label={`Tag ${name}`}
        busy={moment.busy}
        problem={moment.problem}
        onSubmit={hunt.submitWords}
      />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
        {moment.heard ? (
          <button type="button" className="ghost" onClick={hunt.hearAgain} disabled={moment.busy !== null}>
            Ask them to say it again
          </button>
        ) : null}
        <button type="button" className="ghost" onClick={hunt.cancelMoment} disabled={moment.busy !== null}>
          Not now
        </button>
      </div>
      <p className="note" style={{ marginTop: 16 }}>
        You can read the words off the screen here because this is a game about the real one. Out
        there you hear them, from them, once, and nothing else passes between you.
      </p>
    </section>
  );
};
