// Six seconds of the game moving, for the README and the deck. Real footage: the frames come
// out of a game being played, at whatever rate the browser hands them over, and the gif is
// timed to match so nothing is silently sped up.
//
// Needs ffmpeg on PATH. Without it the frames are still written and the gif is skipped, because
// a missing encoder should not fail a run whose other output is fine.
// SPDX-License-Identifier: Apache-2.0

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { type Page, test } from "@playwright/test";

const run = promisify(execFile);

const OUT = resolve(process.cwd(), "../docs/shots");
/** Long enough to get across a courtyard; the take ends on the tag, usually well before this. */
const APPROACH = 72;
/** The map dims, the bubble opens, and five words sit there long enough to read. */
const MOMENT = 30;
const WIDE = 640;
const COLOURS = 96;

/** The map, in page coordinates, measured once so every frame is the same rectangle. */
const stageBox = async (page: Page) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  const box = await page.locator(".hunt-viewport").boundingBox();
  if (box === null) {
    throw new Error("the map is not on the page");
  }
  // Whole pixels, and an even width and height, because gif encoders round and a half pixel of
  // drift shows up as a shimmering edge across the whole loop.
  const width = Math.floor(box.width / 2) * 2;
  const height = Math.floor(box.height / 2) * 2;
  return { x: Math.round(box.x), y: Math.round(box.y), width, height };
};

/**
 * One take of a hunt: walk somebody down, and tag them. Frames come out as fast as the browser
 * will give them up, with no waiting in between, because the game runs on its own clock. The gif
 * is then timed to whatever rate that turned out to be, so nothing is silently sped up.
 */
const record = async (page: Page, dir: string, name: string): Promise<number> => {
  const clip = await stageBox(page);
  const walk = page.getByRole("button", { name: `Walk to ${name}` });
  const tag = page.getByRole("button", { name: `Tag ${name}`, exact: true });
  const began = Date.now();
  let count = 0;
  const shoot = async (): Promise<void> => {
    await page.screenshot({ path: join(dir, `f-${String(count).padStart(4, "0")}.png`), clip });
    count += 1;
  };

  let caught = false;
  for (let frame = 0; frame < APPROACH && !caught; frame += 1) {
    // Re-tapped rather than held, the way a player chases somebody who is also walking away.
    if (frame % 4 === 0 && (await walk.count())) {
      await walk.dispatchEvent("click");
    }
    // A quarter of the way in, break into a run: the dust, the speed and the breath bar move.
    if (frame === Math.round(APPROACH / 4)) {
      await page.keyboard.down("Shift");
    }
    await shoot();
    caught = frame % 3 === 0 && (await tag.isEnabled());
  }
  await page.keyboard.up("Shift");

  if (caught) {
    await tag.click();
    // Clicking the bar under the map brings it into view, which slides the map up under a fixed
    // rectangle. Put the page back where it was measured before shooting any more of it.
    await page.evaluate(() => window.scrollTo(0, 0));
    for (let frame = 0; frame < MOMENT; frame += 1) {
      await shoot();
    }
  }
  return (count * 1000) / Math.max(1, Date.now() - began);
};

/** Two passes, because one shared palette across the whole loop is what keeps a gif from boiling. */
const encode = async (dir: string, gif: string, fps: number): Promise<boolean> => {
  const rate = Math.max(6, Math.min(20, Math.round(fps)));
  const filter = [
    `scale=${WIDE}:-2:flags=lanczos`,
    "split[a][b]",
    `[a]palettegen=max_colors=${COLOURS}:stats_mode=diff[p]`,
    "[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
  ].join(",");
  try {
    await run("ffmpeg", [
      "-y", "-hide_banner", "-loglevel", "error",
      "-framerate", String(rate),
      "-i", join(dir, "f-%04d.png"),
      "-vf", filter,
      "-loop", "0",
      gif,
    ]);
    return true;
  } catch (error) {
    console.warn(`no gif: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
};

test("a hunt, walked down and tagged", async ({ page }, info) => {
  // One loop, at the size the README shows it. A phone-shaped gif of the same six seconds would
  // be a second file nobody looks at.
  test.skip(info.project.name !== "desktop", "the loop is a desktop-width picture");
  test.setTimeout(180_000);

  await page.goto("/?clip=1#/hunt?seed=77&players=8&place=campus");
  await page.getByRole("heading", { name: "One of them is hunting you." }).waitFor();
  await page.getByRole("button", { name: "Practice first" }).click();
  await page.getByRole("button", { name: "Open the envelope" }).click();
  await page.waitForTimeout(1_400);

  const name = (await page.locator(".hud-row strong").first().innerText()).trim();
  const dir = await mkdtemp(join(tmpdir(), "blindside-clip-"));
  await mkdir(OUT, { recursive: true });
  try {
    const fps = await record(page, dir, name);
    const made = await encode(dir, `${OUT}/the-hunt.gif`, fps);
    console.log(`${name} at ${fps.toFixed(1)} frames/s${made ? " -> docs/shots/the-hunt.gif" : ""}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
