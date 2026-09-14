// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from "react";
import type { World } from "../hunt/campus.ts";
import type { Point } from "../hunt/grid.ts";
import { paintMinimap } from "../hunt/paint.ts";
import type { Ring } from "../hunt/ring.ts";

type Props = {
  readonly world: World;
  readonly you: Point | null;
  /** Where the last rumour put your target. Not where they are now. */
  readonly rumour: Point | null;
  /** The ground still open, once the grounds have started closing. */
  readonly ring: Ring | null;
};

/**
 * The campus in miniature. You are the marker; the ring is the last thing you were told, which
 * is already out of date. Nobody's live position is ever on it.
 */
export const Minimap = ({ world, you, rumour, ring }: Props) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current !== null) {
      paintMinimap(ref.current, world, you, rumour, ring);
    }
  }, [world, you, rumour, ring]);
  return (
    <canvas
      ref={ref}
      className="minimap"
      width={world.width * 4}
      height={world.height * 4}
      aria-label="The map, with you on it and the last place your target was heard of"
    />
  );
};
