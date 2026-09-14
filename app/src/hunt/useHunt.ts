// The hunt, wired to the real contract. The simulation decides where people are; the contract
// decides who is still in. This hook is the only place the two meet.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type FeedEntry, SandboxRunner, type Snapshot } from "../sandbox/engine.ts";
import { createSpeaker } from "./audio.ts";
import { CAMPUS, type World } from "./campus.ts";
import { type Dir, type Point, adjacent, chebyshev } from "./grid.ts";
import { ASKING_ABOUT_YOU, RUMOUR_EVERY, rumourAbout, sightings } from "./rumours.ts";
import {
  type Facts,
  type Input,
  type Sim,
  type SimEvent,
  TICK_MS,
  YOU,
  newSim,
  step,
  visibleFromYou,
} from "./sim.ts";

export const HUNT_CAST: readonly string[] = ["You", "Riya", "Sam", "Nina", "Dev", "Tara", "Kabir", "Zoe"];
export const GAME_SECONDS = 300;
const WORDS_SHOWN_MS = 9_000;
const PROVE_MS = 700;
const SAY_MS = 1_600;
const FEED_LIMIT = 40;
/** People keep walking between the button appearing and the press. This much still counts. */
const TAG_REACH = 2;

export type HuntPhase =
  | "intro"
  | "playing"
  | "moment"
  | "caught"
  | "won"
  | "paid"
  | "out"
  | "over"
  | "draw";

export type Moment = {
  readonly words: readonly string[];
  /** The words have been said and have faded. */
  readonly heard: boolean;
  readonly problem: string | null;
  readonly busy: string | null;
};

export type HuntView = {
  readonly phase: HuntPhase;
  readonly practice: boolean;
  readonly sim: Sim;
  readonly facts: Facts;
  readonly snapshot: Snapshot;
  readonly envelopeOpen: boolean;
  readonly worldFeed: readonly FeedEntry[];
  readonly bubbles: ReadonlyMap<number, string>;
  readonly moment: Moment | null;
  readonly caughtBy: number | null;
  readonly winner: number | null;
  readonly busy: string | null;
  readonly muted: boolean;
  readonly secondsLeft: number;
};

export type Hunt = HuntView & {
  readonly world: World;
  readonly names: readonly string[];
  readonly visible: ReadonlySet<number>;
  readonly targetIndex: number | null;
  readonly canTag: boolean;
  readonly start: (practice: boolean) => void;
  readonly openEnvelope: () => void;
  readonly hold: (dir: Dir | null) => void;
  readonly tapTile: (tile: Point) => void;
  readonly tapActor: (index: number) => void;
  readonly beginMoment: () => void;
  readonly hearAgain: () => void;
  readonly submitWords: (spoken: string) => void;
  readonly cancelMoment: () => void;
  readonly sayMyWords: () => void;
  readonly claim: () => void;
  readonly toggleMute: () => void;
  readonly playAgain: () => void;
};

type Ending = { readonly phase: "won" | "over" | "draw"; readonly winner: number | null } | null;

type Change = {
  readonly sim: Sim;
  readonly facts: Facts;
  readonly snapshot: Snapshot;
  readonly notes: readonly FeedEntry[];
  readonly caughtBy: number | null;
  readonly ending: Ending;
  readonly secondsLeft: number;
};

const factsOf = (engine: SandboxRunner, practice: boolean): Facts => {
  const alive = engine.aliveFlags();
  return { targets: engine.edges(), alive, practice, youOut: !(alive[YOU] ?? false) };
};

const seedFromHash = (): number => {
  const match = /seed=(\d+)/.exec(window.location.hash);
  return match?.[1] === undefined ? Date.now() % 2_147_483_647 : Number(match[1]);
};

const prepend = (feed: readonly FeedEntry[], entries: readonly FeedEntry[]): readonly FeedEntry[] =>
  [...[...entries].reverse(), ...feed].slice(0, FEED_LIMIT);

const withBubble = (bubbles: ReadonlyMap<number, string>, index: number, text: string) =>
  new Map([...bubbles, [index, text]]);

const withoutBubble = (bubbles: ReadonlyMap<number, string>, index: number) =>
  new Map([...bubbles].filter(([who]) => who !== index));

/** Bot tags go to the contract; a catch and a tip are for you to hear about. */
const settle = (
  engine: SandboxRunner,
  events: readonly SimEvent[],
): { readonly caughtBy: number | null; readonly notes: readonly string[] } =>
  events.reduce<{ readonly caughtBy: number | null; readonly notes: readonly string[] }>(
    (acc, event) => {
      if (event.type === "botTag") {
        try {
          engine.tagBetween(event.hunter, event.victim);
          return { ...acc, notes: [...acc.notes, `${HUNT_CAST[event.victim] ?? "Somebody"} is out.`] };
        } catch (error) {
          console.error("the contract refused a bot's tag", error);
          return acc;
        }
      }
      if (event.type === "caught") {
        return { ...acc, caughtBy: event.hunter };
      }
      return { ...acc, notes: [...acc.notes, ASKING_ABOUT_YOU] };
    },
    { caughtBy: null, notes: [] },
  );

const rumourNow = (sim: Sim, facts: Facts, envelopeOpen: boolean): string | null => {
  const target = facts.targets[YOU] ?? null;
  const actor = target === null ? undefined : sim.actors[target];
  if (!envelopeOpen || actor === undefined || sim.tick % RUMOUR_EVERY !== 0) {
    return null;
  }
  if (visibleFromYou(sim, CAMPUS, facts).has(actor.index)) {
    return null;
  }
  return rumourAbout(CAMPUS, HUNT_CAST[actor.index] ?? "Your target", actor.at);
};

/** The three ways a game stops on its own. Each one really runs the contract. */
const endingOf = (engine: SandboxRunner, secondsLeft: number): Ending => {
  const snapshot = engine.snapshot();
  if (snapshot.phase === "finished" && !snapshot.claimed) {
    if (snapshot.youWon) {
      return { phase: "won", winner: YOU };
    }
    const winner = engine.aliveFlags().indexOf(true);
    engine.claimBy(winner);
    return { phase: "over", winner };
  }
  if (secondsLeft === 0 && snapshot.phase === "live") {
    engine.letTheDeadlinePass();
    engine.openRefunds();
    engine.refundEveryone();
    return { phase: "draw", winner: null };
  }
  return null;
};

const advanceView = (prev: HuntView, change: Change): HuntView => {
  const caught = change.caughtBy !== null && prev.phase === "playing";
  const phase = caught ? "caught" : (change.ending?.phase ?? prev.phase);
  return {
    ...prev,
    phase,
    sim: change.sim,
    facts: change.facts,
    snapshot: change.snapshot,
    secondsLeft: change.secondsLeft,
    worldFeed: prepend(prev.worldFeed, change.notes),
    caughtBy: caught ? change.caughtBy : prev.caughtBy,
    winner: change.ending?.winner ?? prev.winner,
    bubbles:
      caught && change.caughtBy !== null ? withBubble(prev.bubbles, change.caughtBy, "Got you.") : prev.bubbles,
  };
};

const useLazyRef = <T,>(init: () => T): { current: T } => {
  const ref = useRef<T | null>(null);
  if (ref.current === null) {
    ref.current = init();
  }
  return ref as { current: T };
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));

export const useHunt = (): Hunt => {
  const engineRef = useLazyRef(() => new SandboxRunner(HUNT_CAST));
  const simRef = useLazyRef(() => newSim(CAMPUS, seedFromHash(), HUNT_CAST.length));
  const speaker = useMemo(createSpeaker, []);
  const heldRef = useRef<Dir | null>(null);
  const pendingRef = useRef<{ tapped: Point | null; follow: number | null }>({ tapped: null, follow: null });
  const practiceRef = useRef(false);
  const envelopeRef = useRef(false);
  const nextIdRef = useRef(1);
  const wordsTimerRef = useRef<number | null>(null);

  const [view, setView] = useState<HuntView>(() => ({
    phase: "intro",
    practice: false,
    sim: simRef.current,
    facts: factsOf(engineRef.current, false),
    snapshot: engineRef.current.snapshot(),
    envelopeOpen: false,
    worldFeed: [],
    bubbles: new Map(),
    moment: null,
    caughtBy: null,
    winner: null,
    busy: null,
    muted: speaker.muted(),
    secondsLeft: GAME_SECONDS,
  }));

  const entries = useCallback((texts: readonly string[]): readonly FeedEntry[] =>
    texts.map((text) => {
      const id = nextIdRef.current;
      nextIdRef.current += 1;
      return { id, text };
    }), []);

  const tick = useCallback(() => {
    const engine = engineRef.current;
    const before = simRef.current;
    const facts = factsOf(engine, practiceRef.current);
    const input: Input = { dir: heldRef.current, ...pendingRef.current };
    pendingRef.current = { tapped: null, follow: null };
    const { sim, events } = step(before, CAMPUS, facts, input);
    simRef.current = sim;
    const seen = sightings(CAMPUS, before, sim, facts, HUNT_CAST);
    const settled = settle(engine, events);
    const rumour = rumourNow(sim, facts, envelopeRef.current);
    const secondsLeft = Math.max(0, GAME_SECONDS - Math.floor((sim.tick * TICK_MS) / 1000));
    const ending = endingOf(engine, secondsLeft);
    if (settled.caughtBy !== null) {
      speaker.play("caught");
    } else if (rumour !== null || events.some((event) => event.type === "tip")) {
      speaker.play("rumour");
    }
    if (ending?.phase === "over" || ending?.phase === "draw") {
      speaker.play("win");
    }
    const notes = entries([...seen, ...settled.notes, ...(rumour === null ? [] : [rumour])]);
    setView((prev) =>
      advanceView(prev, {
        sim,
        facts: factsOf(engine, practiceRef.current),
        snapshot: engine.snapshot(),
        notes,
        caughtBy: settled.caughtBy,
        ending,
        secondsLeft,
      }),
    );
  }, [engineRef, simRef, speaker, entries]);

  useEffect(() => {
    if (view.phase !== "playing" && view.phase !== "out") {
      return;
    }
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [view.phase, tick]);

  useEffect(
    () => () => {
      if (wordsTimerRef.current !== null) {
        window.clearTimeout(wordsTimerRef.current);
      }
    },
    [],
  );

  const start = useCallback(
    (practice: boolean) => {
      practiceRef.current = practice;
      speaker.play("open");
      const opening = practice
        ? "Practice: nobody is hunting you and the roofs are off."
        : "Somebody here is hunting you. You do not know who.";
      setView((prev) => ({
        ...prev,
        phase: "playing",
        practice,
        facts: factsOf(engineRef.current, practice),
        worldFeed: prepend(prev.worldFeed, entries([opening, "Eight players. The game is live."])),
      }));
    },
    [engineRef, entries, speaker],
  );

  const openEnvelope = useCallback(() => {
    envelopeRef.current = true;
    speaker.play("open");
    const target = engineRef.current.edges()[YOU] ?? null;
    const name = target === null ? "nobody" : (HUNT_CAST[target] ?? "somebody");
    setView((prev) => ({
      ...prev,
      envelopeOpen: true,
      worldFeed: prepend(prev.worldFeed, entries([`Your target is ${name}. Only this screen knows.`])),
    }));
  }, [engineRef, entries, speaker]);

  const hold = useCallback((dir: Dir | null) => {
    heldRef.current = dir;
  }, []);

  const tapTile = useCallback((tile: Point) => {
    pendingRef.current = { tapped: tile, follow: null };
  }, []);

  const tapActor = useCallback((index: number) => {
    pendingRef.current = { tapped: null, follow: index };
  }, []);

  const fadeWordsLater = useCallback(
    (target: number) => {
      if (wordsTimerRef.current !== null) {
        window.clearTimeout(wordsTimerRef.current);
      }
      wordsTimerRef.current = window.setTimeout(() => {
        setView((prev) =>
          prev.phase === "moment" && prev.moment !== null
            ? { ...prev, bubbles: withoutBubble(prev.bubbles, target), moment: { ...prev.moment, heard: true } }
            : prev,
        );
      }, WORDS_SHOWN_MS);
    },
    [],
  );

  const beginMoment = useCallback(() => {
    const engine = engineRef.current;
    const target = engine.edges()[YOU] ?? null;
    const you = simRef.current.actors[YOU];
    const them = target === null ? undefined : simRef.current.actors[target];
    const words = engine.snapshot().theirWords;
    if (target === null || you === undefined || them === undefined || words === null) {
      return;
    }
    if (chebyshev(you.at, them.at) > TAG_REACH || !visibleFromYou(simRef.current, CAMPUS, factsOf(engine, practiceRef.current)).has(target)) {
      return;
    }
    speaker.play("words");
    setView((prev) =>
      prev.phase === "playing"
        ? {
            ...prev,
            phase: "moment",
            moment: { words, heard: false, problem: null, busy: null },
            bubbles: withBubble(prev.bubbles, target, words.join(" ")),
          }
        : prev,
    );
    fadeWordsLater(target);
  }, [engineRef, simRef, speaker, fadeWordsLater]);

  const hearAgain = useCallback(() => {
    const target = engineRef.current.edges()[YOU] ?? null;
    if (target === null) {
      return;
    }
    speaker.play("words");
    setView((prev) =>
      prev.moment === null
        ? prev
        : { ...prev, moment: { ...prev.moment, heard: false, problem: null }, bubbles: withBubble(prev.bubbles, target, prev.moment.words.join(" ")) },
    );
    fadeWordsLater(target);
  }, [engineRef, speaker, fadeWordsLater]);

  const cancelMoment = useCallback(() => {
    setView((prev) => (prev.phase === "moment" ? { ...prev, phase: "playing", moment: null, bubbles: new Map() } : prev));
  }, []);

  const submitWords = useCallback(
    (spoken: string) => {
      const engine = engineRef.current;
      const refusal = engine.wouldRefuse(spoken);
      if (refusal !== null) {
        speaker.play("refuse");
        setView((prev) => (prev.moment === null ? prev : { ...prev, moment: { ...prev.moment, problem: refusal } }));
        return;
      }
      const target = engine.edges()[YOU] ?? null;
      const name = target === null ? "them" : (HUNT_CAST[target] ?? "them");
      const setBusy = (busy: string | null) =>
        setView((prev) => (prev.moment === null ? prev : { ...prev, moment: { ...prev.moment, busy, problem: null } }));
      void (async () => {
        setBusy("Proving the tag");
        await delay(PROVE_MS);
        setBusy("Settling");
        await delay(PROVE_MS);
        const problem = engine.tagYourTarget(spoken);
        if (problem !== null) {
          speaker.play("refuse");
          setView((prev) => (prev.moment === null ? prev : { ...prev, moment: { ...prev.moment, busy: null, problem } }));
          return;
        }
        envelopeRef.current = false;
        const snapshot = engine.snapshot();
        speaker.play(snapshot.youWon ? "win" : "tag");
        setView((prev) => ({
          ...prev,
          phase: snapshot.youWon ? "won" : "playing",
          moment: null,
          bubbles: new Map(),
          envelopeOpen: false,
          snapshot,
          facts: factsOf(engine, practiceRef.current),
          winner: snapshot.youWon ? YOU : prev.winner,
          worldFeed: prepend(prev.worldFeed, entries([`You tagged ${name}. Their target is yours now, sealed.`])),
        }));
      })();
    },
    [engineRef, entries, speaker],
  );

  const sayMyWords = useCallback(() => {
    const engine = engineRef.current;
    const words = engine.snapshot().yourWords;
    const hunter = view.caughtBy;
    if (words === null || hunter === null) {
      return;
    }
    speaker.play("words");
    setView((prev) => ({ ...prev, busy: "Saying them", bubbles: withBubble(prev.bubbles, YOU, words.join(" ")) }));
    void (async () => {
      await delay(SAY_MS);
      try {
        engine.tagBetween(hunter, YOU);
      } catch (error) {
        console.error("the contract refused your hunter's tag", error);
      }
      setView((prev) => ({
        ...prev,
        phase: "out",
        busy: null,
        bubbles: new Map(),
        snapshot: engine.snapshot(),
        facts: factsOf(engine, practiceRef.current),
        worldFeed: prepend(prev.worldFeed, entries(["You said your words. You are out. The roofs are off now: watch how it ends."])),
      }));
    })();
  }, [engineRef, entries, speaker, view.caughtBy]);

  const claim = useCallback(() => {
    const engine = engineRef.current;
    void (async () => {
      setView((prev) => ({ ...prev, busy: "Proving you are the last one" }));
      await delay(PROVE_MS);
      setView((prev) => ({ ...prev, busy: "Settling" }));
      await delay(PROVE_MS);
      engine.claim();
      speaker.play("win");
      setView((prev) => ({ ...prev, phase: "paid", busy: null, snapshot: engine.snapshot() }));
    })();
  }, [engineRef, speaker]);

  const toggleMute = useCallback(() => {
    const muted = speaker.toggle();
    setView((prev) => ({ ...prev, muted }));
  }, [speaker]);

  const playAgain = useCallback(() => {
    window.location.reload();
  }, []);

  const visible = useMemo(() => visibleFromYou(view.sim, CAMPUS, view.facts), [view.sim, view.facts]);
  const targetIndex = view.envelopeOpen && !view.facts.youOut ? (view.facts.targets[YOU] ?? null) : null;
  const you = view.sim.actors[YOU];
  const them = targetIndex === null ? undefined : view.sim.actors[targetIndex];
  const canTag =
    view.phase === "playing" &&
    targetIndex !== null &&
    you !== undefined &&
    them !== undefined &&
    visible.has(targetIndex) &&
    adjacent(you.at, them.at);

  return {
    ...view,
    world: CAMPUS,
    names: HUNT_CAST,
    visible,
    targetIndex,
    canTag,
    start,
    openEnvelope,
    hold,
    tapTile,
    tapActor,
    beginMoment,
    hearAgain,
    submitWords,
    cancelMoment,
    sayMyWords,
    claim,
    toggleMute,
    playAgain,
  };
};
