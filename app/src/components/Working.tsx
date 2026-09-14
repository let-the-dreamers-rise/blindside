// What a twenty to thirty second wait should look like: the step it is on, how long it has
// taken, and every step it has already finished.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from "react";

export type Step = { readonly what: string; readonly at: number };

const seconds = (ms: number): string => `${Math.round(ms / 1000)}s`;

type Props = {
  readonly label: string;
  readonly steps: readonly Step[];
  readonly startedAt: number;
};

export const Working = ({ label, steps, startedAt }: Props) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  const current = steps.at(-1);
  const done = steps.slice(0, -1);

  return (
    <div className="working" aria-live="polite">
      <p className="mono working-now">
        <span className="pip" aria-hidden="true" />
        {current?.what ?? label}
        <span className="working-clock">{seconds(now - startedAt)}</span>
      </p>
      {done.length === 0 ? null : (
        <ol className="working-done">
          {done.map((step, index) => (
            <li key={`${step.at}-${step.what}`} className="mono">
              {step.what}
              <span className="working-clock">
                {seconds((steps[index + 1]?.at ?? now) - step.at)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
