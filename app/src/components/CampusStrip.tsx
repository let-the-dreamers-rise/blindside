// A still of the campus for the front page: this is the game, not a diagram of it.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from "react";
import { TILE } from "../hunt/art.ts";
import { CAMPUS } from "../hunt/campus.ts";
import { paintPoster } from "../hunt/paint.ts";

// Four people near the fountain, one of them facing the others. Nothing about the arrangement
// means anything: it is a picture of a night nobody has played yet.
const CAST = [
  { at: { x: 15, y: 9 }, index: 3, facing: 1 as const },
  { at: { x: 22, y: 10 }, index: 1, facing: -1 as const },
  { at: { x: 19, y: 8 }, index: 0, facing: 1 as const },
  { at: { x: 26, y: 13 }, index: 5, facing: -1 as const },
  { at: { x: 11, y: 13 }, index: 2, facing: 1 as const },
];

export const CampusStrip = () => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current !== null) {
      paintPoster(ref.current, CAMPUS, CAST);
    }
  }, []);

  return (
    <div className="strip" aria-hidden="true">
      <canvas ref={ref} width={CAMPUS.width * TILE} height={CAMPUS.height * TILE} />
    </div>
  );
};
