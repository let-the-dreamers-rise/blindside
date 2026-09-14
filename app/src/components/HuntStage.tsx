// The campus, the people on it, and the camera that follows you.
// SPDX-License-Identifier: Apache-2.0

import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { SPRITE_HEIGHT, SPRITE_WIDTH, TILE } from "../hunt/art.ts";
import { type Room, type World, roomOf } from "../hunt/campus.ts";
import type { Point } from "../hunt/grid.ts";
import { paintGround } from "../hunt/paint.ts";
import { spriteUrl } from "../hunt/pixels.ts";
import { type Actor, YOU } from "../hunt/sim.ts";
import type { Hunt } from "../hunt/useHunt.ts";

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

type PersonProps = {
  readonly actor: Actor;
  readonly name: string;
  readonly out: boolean;
  readonly isTarget: boolean;
  readonly bubble: string | undefined;
  readonly onTap: () => void;
};

const Person = ({ actor, name, out, isTarget, bubble, onTap }: PersonProps) => {
  const isYou = actor.index === YOU;
  const label = isYou ? "You" : out ? `${name}, out` : `Walk to ${name}`;
  return (
    <button
      type="button"
      className={`actor${isYou ? " you" : ""}${out ? " out" : ""}`}
      style={{
        transform: `translate(${actor.at.x * TILE + (TILE - SPRITE_WIDTH) / 2}px, ${actor.at.y * TILE + TILE - SPRITE_HEIGHT}px)`,
      }}
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
  const { world, sim, facts, visible, names, targetIndex, bubbles } = hunt;
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
    const viewport = viewportRef.current;
    if (viewport === null) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect !== undefined) {
        setSize({ w: rect.width, h: rect.height });
      }
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const you = sim.actors[YOU];
  const camera = cameraFor(you?.at ?? { x: 0, y: 0 }, size, world);
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
    <div className="hunt-viewport" ref={viewportRef}>
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
        {sim.actors
          .filter((actor) => visible.has(actor.index))
          .map((actor) => (
            <Person
              key={actor.index}
              actor={actor}
              name={names[actor.index] ?? "someone"}
              out={!(facts.alive[actor.index] ?? false)}
              isTarget={actor.index === targetIndex}
              bubble={bubbles.get(actor.index)}
              onTap={() => hunt.tapActor(actor.index)}
            />
          ))}
        {!roofsOff && you !== undefined ? (
          <div className="lantern" style={{ background: lanternAt(you.at) }} aria-hidden="true" />
        ) : null}
      </div>
      {children}
    </div>
  );
};
