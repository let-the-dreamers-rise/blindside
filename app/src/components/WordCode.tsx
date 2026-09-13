// The handover, both halves of it: the words you say, and the box you type theirs into.
// SPDX-License-Identifier: Apache-2.0

import { type FormEvent, useEffect, useState } from "react";
import QRCode from "qrcode";

const HIDE_AFTER_MS = 45_000;

type YourWordsProps = {
  readonly words: readonly string[];
};

/**
 * Hold to reveal. Somebody who photographs these still cannot use them: a tag also needs a note
 * pointing at you, which only your own hunter holds.
 */
export const YourWords = ({ words }: YourWordsProps) => {
  const [shown, setShown] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const said = words.join(" ");

  useEffect(() => {
    let live = true;
    void QRCode.toDataURL(said, { margin: 1, width: 220, errorCorrectionLevel: "M" }).then(
      (url) => {
        if (live) {
          setImage(url);
        }
      },
    );
    return () => {
      live = false;
    };
  }, [said]);

  useEffect(() => {
    if (!shown) {
      return;
    }
    const timer = window.setTimeout(() => setShown(false), HIDE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [shown]);

  if (!shown) {
    return (
      <button className="ghost" onClick={() => setShown(true)}>
        Show my words
      </button>
    );
  }

  return (
    <div aria-live="polite">
      <ol className="words">
        {words.map((word, index) => (
          <li key={`${index}-${word}`}>
            <span className="mono">{index + 1}</span>
            {word}
          </li>
        ))}
      </ol>
      <p className="note" style={{ marginTop: 12 }}>
        Say these out loud only to somebody who has genuinely tagged you. Down a phone, across a
        room, in a group chat: it does not matter which, and nothing else has to pass between you.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        <button className="ghost" onClick={() => setShown(false)}>
          Hide them
        </button>
        {image === null ? null : (
          <details>
            <summary className="mono">or let them scan it</summary>
            <div className="qr" style={{ marginTop: 12 }}>
              <img src={image} alt="Your five words, as a QR code" width={220} height={220} />
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

type TypeTheirWordsProps = {
  readonly label: string;
  readonly busy: string | null;
  readonly problem: string | null;
  readonly onSubmit: (spoken: string) => void;
};

/** What a hunter types after their target has said five words. */
export const TypeTheirWords = ({
  label,
  busy,
  problem,
  onSubmit,
}: TypeTheirWordsProps) => {
  const [spoken, setSpoken] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy === null) {
      onSubmit(spoken);
    }
  };

  return (
    <form onSubmit={submit}>
      <label htmlFor="spoken">What they said</label>
      <input
        id="spoken"
        value={spoken}
        onChange={(event) => setSpoken(event.target.value)}
        placeholder="five words"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        disabled={busy !== null}
      />
      {problem === null ? null : (
        <p className="note" style={{ marginTop: 12 }} role="alert">
          {problem}
        </p>
      )}
      <button type="submit" disabled={busy !== null} style={{ marginTop: 14 }}>
        {busy ?? label}
      </button>
    </form>
  );
};
