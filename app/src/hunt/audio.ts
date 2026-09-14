// A few notes, synthesised on the spot. Nothing to download, nothing to license, and quiet
// until the first tap because browsers insist on it.
// SPDX-License-Identifier: Apache-2.0

export type Sound = "open" | "words" | "tag" | "refuse" | "caught" | "rumour" | "win" | "behind";

type Note = readonly [frequency: number, ms: number];

const TUNES: Readonly<Record<Sound, readonly Note[]>> = {
  open: [[659, 70], [880, 110]],
  words: [[523, 60], [523, 60], [659, 90]],
  tag: [[523, 80], [659, 80], [784, 80], [1047, 160]],
  refuse: [[196, 140], [175, 200]],
  caught: [[220, 180], [165, 320]],
  rumour: [[440, 50], [554, 70]],
  // Two low notes a step apart, close together: a footfall behind you, not a fanfare.
  behind: [[147, 90], [131, 110]],
  win: [[523, 110], [659, 110], [784, 110], [1047, 110], [1319, 260]],
};

const MUTED_KEY = "blindside:muted";

const readMuted = (): boolean => {
  try {
    return window.localStorage.getItem(MUTED_KEY) === "yes";
  } catch {
    return false;
  }
};

const writeMuted = (muted: boolean): void => {
  try {
    window.localStorage.setItem(MUTED_KEY, muted ? "yes" : "no");
  } catch {
    // A private window with storage off still plays; it just forgets the choice.
  }
};

const schedule = (context: AudioContext, notes: readonly Note[]): void => {
  const start = context.currentTime + 0.01;
  notes.reduce((at, [frequency, ms]) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.12, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + ms / 1000);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + ms / 1000 + 0.02);
    return at + ms / 1000;
  }, start);
};

export type Speaker = {
  readonly play: (sound: Sound) => void;
  readonly toggle: () => boolean;
  readonly muted: () => boolean;
};

export const createSpeaker = (): Speaker => {
  let context: AudioContext | null = null;
  let muted = readMuted();
  const play = (sound: Sound): void => {
    if (muted || typeof window === "undefined" || typeof window.AudioContext !== "function") {
      return;
    }
    try {
      context ??= new window.AudioContext();
      if (context.state === "suspended") {
        void context.resume();
      }
      schedule(context, TUNES[sound]);
    } catch {
      // No speaker is not a reason to stop the game.
    }
  };
  const toggle = (): boolean => {
    muted = !muted;
    writeMuted(muted);
    return muted;
  };
  return { play, toggle, muted: () => muted };
};
