// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from "react";
import type { World } from "../hunt/campus.ts";
import type { Point } from "../hunt/grid.ts";
import { paintMinimap } from "../hunt/paint.ts";

type Props = { readonly world: World; readonly you: Point | null };

/** The campus in miniature. You are the red square. Nobody else is on it, deliberately. */
export const Minimap = ({ world, you }: Props) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current !== null) {
      paintMinimap(ref.current, world, you);
    }
  }, [world, you]);
  return (
    <canvas
      ref={ref}
      className="minimap"
      width={world.width * 4}
      height={world.height * 4}
      aria-label="The campus, with you on it"
    />
  );
};
