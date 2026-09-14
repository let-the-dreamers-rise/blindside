// The other place. Forty by twenty-four again, but almost nothing else is the same: a wood down
// the west side, a lake in the north east, and a bandstand in the middle of an open lawn.
//
// Trees stop sight now, so a wood is not scenery. On the campus you are hidden by being indoors
// or by standing in a crowd; here you are hidden by the trees, and the lawn in the middle is the
// most dangerous ground in either place.
//   .  grass   ,  path   T  tree   W  wall   _  floor   D  door   ~  water   =  bench
// SPDX-License-Identifier: Apache-2.0

import { type World, makeWorld } from "./campus.ts";

export const PARK_ROWS: readonly string[] = [
  "T.T.T.....,,...T...........,,........T..",
  "..T.T..T..,,......T........,,..T.T......",
  "T...T.....,,..T............,,....T.T....",
  ",,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,",
  "T.T.......,,...WWWWWWW.....,,.~~~~~~~~~.",
  "..T.T..T..,,...W_____W.....,,.~~~~~~~~~.",
  "T...T.....,,...W_____W.....,,.~~~~~~~~~.",
  "..T....T..,,...W_____W.....,,.~~~~~~~~~.",
  "T.T.T.....,,...WWWDWWW.....,,.~~~~~~~~~.",
  "....T.....,,.............=.,,...........",
  ",,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,",
  "T.T.......,,...............,,...........",
  "..T.T..T..,,.......T.......,,....T......",
  "T...T.....,,...............,,...WWWWWWW.",
  "WWWWWWW...,,......=........,,...W_____W.",
  "W_____W...,,...............,,...W_____W.",
  "W_____W...,,......T........,,...W_____W.",
  "W_____W...,,...............,,...WWWDWWW.",
  "WWWDWWW...,,.......=.......,,...........",
  ",,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,",
  "T.T....T..,,.....T.........,,....T.T....",
  "..T.T.....,,...............,,..T.T.T....",
  "T...T..T..,,......T........,,....T.T....",
  "..T.......,,...........T...,,..T.T.T.T..",
];

export const PARK: World = makeWorld({
  rows: PARK_ROWS,
  rooms: [
    { name: "Bandstand", at: { x: 18, y: 5 } },
    { name: "Greenhouse", at: { x: 3, y: 16 } },
    { name: "Boathouse", at: { x: 35, y: 15 } },
  ],
  landmarks: [
    { name: "the bandstand", at: { x: 18, y: 9 } },
    { name: "the lake", at: { x: 34, y: 10 } },
    { name: "the west wood", at: { x: 2, y: 12 } },
    { name: "the north gate", at: { x: 19, y: 3 } },
    { name: "the south gate", at: { x: 19, y: 19 } },
    { name: "the long bench", at: { x: 18, y: 14 } },
  ],
  spawns: [
    { x: 19, y: 11 },
    { x: 5, y: 3 },
    { x: 35, y: 3 },
    { x: 15, y: 10 },
    { x: 33, y: 10 },
    { x: 5, y: 19 },
    { x: 35, y: 19 },
    { x: 20, y: 22 },
    { x: 24, y: 3 },
    { x: 10, y: 14 },
    { x: 28, y: 12 },
    { x: 24, y: 19 },
  ],
});
