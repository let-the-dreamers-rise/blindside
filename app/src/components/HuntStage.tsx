// The place, the people on it, and the camera that follows you.
// SPDX-License-Identifier: Apache-2.0

import {
  type PointerEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { SPRITE_HEIGHT, SPRITE_WIDTH, TILE } from "../hunt/art.ts";
import { type Room, type World, roomOf } from "../hunt/campus.ts";
import type { Point } from "../hunt/grid.ts";
import { paintGround } from "../hunt/paint.ts";
import { spriteUrl } from "../hunt/pixels.ts";
import { type Actor, YOU } from "../hunt/sim.ts";
import type { Hunt } from "../hunt/useHunt.ts";
import { ChainEye } from "./ChainEye.tsx";
import { Minimap } from "./Minimap.tsx";

/** The two phases where you are standing on the map. Everything else puts a card over it. */
const ON_THE_MAP: ReadonlySet<Hunt["phase"]> = new Set(["playing", "moment"] as const);

type Size = { readonly w: number; readonly h: number };

const axis = (centre: number, view: number, total: number): number =>
  total <= view ? -(view - total) / 2 : Math.min(Math.max(centre - view / 2, 0), total - view);

const cameraFor = (at: Point, size: Size, world: World): Point => ({
  x: axis(at.x * TILE + TILE / 2, size.w, world.width * TILE),
  y: axis(at.y * TILE + TILE / 2, size.h, world.height * TILE),
});

const lanternAt = (at: Point): string => {
  const cx = at.x * TILE + TILE / 2;
  const cy = at.y * TILE + TILE / 2;
  return `radial-gradient(circle at ${cx}px ${cy}px, rgba(11, 10, 9, 0) 0, rgba(11, 10, 9, 0) 150px, rgba(11, 10, 9, 0.72) 340px)`;
};

const Roof = ({ room, hidden }: { readonly room: Room; readonly hidden: boolean }) => {
  const doorOnTop = room.door.y < room.bounds.y;
  const y = doorOnTop ? room.bounds.y : room.bounds.y - 1;
  return (
    <div
      className="roof"
      hidden={hidden}
      style={{
        left: (room.bounds.x - 1) * TILE,
        top: y * TILE,
        width: (room.bounds.w + 2) * TILE,
        height: (room.bounds.h + 1) * TILE,
      }}
    >
      <span>{room.name}</span>
    </div>
  );
};

/** Everybody on the campus stands at the same offset, sorted so the nearer ones are in front. */
const place = (actor: Actor) => ({
  transform: `translate(${actor.at.x * TILE + (TILE - SPRITE_WIDTH) / 2}px, ${actor.at.y * TILE + TILE - SPRITE_HEIGHT}px)`,
  zIndex: 2 + actor.at.y,
});

/** A stranger. Not in the game, not tappable, and never named. */
const Stranger = ({ actor }: { readonly actor: Actor }) => (
  <div className="actor stranger" style={place(actor)} aria-hidden="true">
    <span className="shadow" />
    <img
      src={spriteUrl(actor.index, actor.frame, false)}
      alt=""
      width={SPRITE_WIDTH}
      height={SPRITE_HEIGHT}
      style={{ transform: `scaleX(${actor.facing})` }}
      draggable={false}
    />
  </div>
);

type PersonProps = {
  readonly actor: Actor;
  readonly name: string;
  readonly out: boolean;
  readonly isTarget: boolean;
  readonly hidden: boolean;
  readonly running: boolean;
  readonly bubble: string | undefined;
  readonly onTap: () => void;
};

const Person = ({ actor, name, out, isTarget, hidden, running, bubble, onTap }: PersonProps) => {
  const isYou = actor.index === YOU;
  const label = isYou ? "You" : out ? `${name}, out` : `Walk to ${name}`;
  return (
    <button
      type="button"
      className={`actor${isYou ? " you" : ""}${out ? " out" : ""}${hidden ? " hidden-in-crowd" : ""}`}
      style={place(actor)}
      aria-label={label}
      disabled={isYou || out}
      onClick={onTap}
      data-index={actor.index}
    >
      {isTarget ? <span className="marker target" aria-hidden="true" /> : null}
      {isYou ? <span className="marker you" aria-hidden="true" /> : null}
      {bubble === undefined ? null : (
        <span className="bubble" role="status" data-testid={isYou ? "your-bubble" : "bubble"}>
          {bubble}
        </span>
      )}
      <span className="shadow" />
      {running ? <span className="dust" aria-hidden="true" /> : null}
      <img
        src={spriteUrl(actor.index, actor.frame, out)}
        alt=""
        width={SPRITE_WIDTH}
        height={SPRITE_HEIGHT}
        style={{ transform: `scaleX(${actor.facing})` }}
        draggable={false}
      />
      <span className="nameplate">{isYou ? "you" : name}</span>
    </button>
  );
};

type Props = { readonly hunt: Hunt; readonly children?: ReactNode };

export const HuntStage = ({ hunt, children }: Props) => {
  const { world, sim, facts, visible, names, targetIndex, bubbles, jolt } = hunt;
  const [shaking, setShaking] = useState(false);
  const groundRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });

  useEffect(() => {
    if (groundRef.current !== null) {
      paintGround(groundRef.current, world);
    }
  }, [world]);

  useEffect(() => {
    if (jolt === 0) {
      return;
    }
    setShaking(true);
    const timer = window.setTimeout(() => setShaking(false), 380);
    return () => window.clearTimeout(timer);
  }, [jolt]);

  // Measured before the first paint, or the camera spends a frame clamped to a corner and the
  // campus visibly jumps into place.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null) {
      return;
    }
    const rect = viewport.getBoundingClientRect();
    setSize({ w: rect.width, h: rect.height });
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect;
      if (next !== undefined) {
        setSize({ w: next.width, h: next.height });
      }
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const you = sim.actors[YOU];
  // While somebody is saying their words the camera sits between the two of you, so the bubble
  // is never half off the edge of the screen.
  const them = targetIndex === null ? undefined : sim.actors[targetIndex];
  const focus =
    hunt.phase === "moment" && you !== undefined && them !== undefined
      ? { x: (you.at.x + them.at.x) / 2, y: (you.at.y + them.at.y) / 2 }
      : (you?.at ?? { x: 0, y: 0 });
  const camera = cameraFor(focus, size, world);
  const roofsOff = facts.practice || facts.youOut;
  const inside = you === undefined ? null : roomOf(world, you.at);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (stage === null || (event.target as HTMLElement).closest(".actor") !== null) {
      return;
    }
    const rect = stage.getBoundingClientRect();
    hunt.tapTile({
      x: Math.floor((event.clientX - rect.left) / TILE),
      y: Math.floor((event.clientY - rect.top) / TILE),
    });
  };

  return (
    <div
      className={`hunt-viewport${shaking ? " jolt" : ""}${hunt.phase === "moment" ? " listening" : ""}`}
      ref={viewportRef}
    >
      <div
        className="hunt-stage"
        ref={stageRef}
        style={{
          width: world.width * TILE,
          height: world.height * TILE,
          transform: `translate(${-camera.x}px, ${-camera.y}px)`,
        }}
        onPointerDown={onPointerDown}
      >
        <canvas
          ref={groundRef}
          className="hunt-ground"
          width={world.width * TILE}
          height={world.height * TILE}
          aria-hidden="true"
        />
        {world.rooms.map((room, index) => (
          <Roof key={room.name} room={room} hidden={roofsOff || inside === index} />
        ))}
        {sim.ring === null ? null : (
          <div
            className="grounds"
            aria-hidden="true"
            style={{
              left: sim.ring.x0 * TILE,
              top: sim.ring.y0 * TILE,
              width: (sim.ring.x1 - sim.ring.x0 + 1) * TILE,
              height: (sim.ring.y1 - sim.ring.y0 + 1) * TILE,
            }}
          />
        )}
        {sim.extras.map((extra) => (
          <Stranger key={extra.index} actor={extra} />
        ))}
        {sim.actors
          .filter((actor) => visible.has(actor.index))
          .map((actor) => (
            <Person
              key={actor.index}
              actor={actor}
              name={names[actor.index] ?? "someone"}
              out={!(facts.alive[actor.index] ?? false)}
              isTarget={actor.index === targetIndex}
              hidden={actor.index === YOU && hunt.hidden}
              running={actor.index === YOU && sim.sprinting}
              bubble={bubbles.get(actor.index)}
              onTap={() => hunt.tapActor(actor.index)}
            />
          ))}
        {!roofsOff && you !== undefined ? (
          <div className="lantern" style={{ background: lanternAt(you.at) }} aria-hidden="true" />
        ) : null}
      </div>
      {/*
        A phone shows about a third of the ground at a time, so without this you cannot see where
        the grounds have closed to, or which way the rumour pointed. It carries nobody's live
        position, only yours, because that is all it is ever given.
      */}
      {ON_THE_MAP.has(hunt.phase) && !hunt.chainEye ? (
        <Minimap world={world} you={you?.at ?? null} rumour={hunt.rumourAt} ring={sim.ring} />
      ) : null}
      {hunt.chainEye ? (
        <ChainEye snapshot={hunt.snapshot} onClose={hunt.toggleChainEye} />
      ) : null}
      {children}
    </div>
  );
};
