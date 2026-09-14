// The demo, played rather than mocked up, paced so the script in docs/VIDEO.md can be read over
// it. Nothing here asserts; if the game changes, the video changes with it.
// SPDX-License-Identifier: Apache-2.0

import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { type Page, test } from "@playwright/test";

const run = promisify(execFile);
const OUT = resolve(process.cwd(), "../docs");

/**
 * A beat: long enough for a sentence of voiceover to land before the next thing moves. Every one
 * of them starts from the top of the page, because clicking a button in the bar under the map
 * scrolls it into view and the map slides up out of frame.
 */
const beat = async (page: Page, ms: number): Promise<void> => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(ms);
};

/** Walks up to somebody the way a player does: tap them, wait, tap again. */
const walkUpTo = async (page: Page, name: string): Promise<boolean> => {
  const tag = page.getByRole("button", { name: `Tag ${name}`, exact: true });
  for (let attempt = 0; attempt < 140; attempt += 1) {
    const walk = page.getByRole("button", { name: `Walk to ${name}` });
    if (await walk.count()) {
      await walk.dispatchEvent("click");
    }
    if (await tag.isEnabled()) {
      return true;
    }
    await page.waitForTimeout(250);
  }
  return false;
};

/** h264 in an mp4, because a webm is refused by half the places a submission gets uploaded. */
const convert = async (webm: string, mp4: string): Promise<boolean> => {
  try {
    await run("ffmpeg", [
      "-y", "-hide_banner", "-loglevel", "error",
      "-i", webm,
      "-c:v", "libx264", "-preset", "slow", "-crf", "20",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      mp4,
    ]);
    return true;
  } catch (error) {
    console.warn(`no mp4: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
};

/** The take itself. A real hunt, so any of it can go differently on any given night. */
const play = async (page: Page): Promise<void> => {
  // The front page: what it is, in one line, over a campus that is already moving.
  await page.goto("/#/");
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  await beat(page, 5_000);

  // The choice, so the size and the place read as the player's rather than the demo's.
  await page.getByRole("button", { name: "Play the hunt" }).click();
  await page.getByRole("heading", { name: "One of them is hunting you." }).waitFor();
  await beat(page, 4_000);
  await page.getByRole("group", { name: "How many are playing" }).getByText("4").click();
  await beat(page, 2_500);

  // A real hunt, not practice: the roofs stay on and somebody really is hunting back.
  await page.getByRole("button", { name: "Start the hunt" }).click();
  await beat(page, 3_000);
  await page.getByRole("button", { name: "Open the envelope" }).click();
  await beat(page, 4_000);

  const name = (await page.locator(".hud-row strong").first().innerText()).trim();
  if (await walkUpTo(page, name)) {
    await beat(page, 1_200);
    await page.getByRole("button", { name: `Tag ${name}`, exact: true }).click();
    await beat(page, 3_500);

    const bubble = page.getByTestId("bubble");
    if (await bubble.isVisible()) {
      // Typed a word at a time, because the point is that somebody said them out loud.
      await page.getByLabel("What they said").pressSequentially((await bubble.innerText()).trim(), {
        delay: 55,
      });
      await beat(page, 1_500);
      await page.locator("form").getByRole("button", { name: `Tag ${name}` }).click();
      await beat(page, 5_000);
    }
  }

  // The same moment, read off the public record. This is the shot the whole thing is for.
  await page.getByRole("button", { name: "The chain", exact: true }).click();
  await beat(page, 11_000);
  await page.getByRole("button", { name: "Back to the map" }).click();
  await beat(page, 2_500);

  // Then keep walking while the grounds close. Standing still for twenty seconds of a real hunt
  // is how the take ends with somebody behind you, which is true to the game and a poor ending.
  for (let leg = 0; leg < 10; leg += 1) {
    const key = leg % 2 === 0 ? "d" : "w";
    await page.keyboard.down(key);
    await beat(page, 2_000);
    await page.keyboard.up(key);
  }
};

test("the demo, in one take", async ({ page }) => {
  // A hunt that ends early, or a target who will not be cornered, should still leave a file to
  // look at. Whatever went wrong is reported after the take is saved, not instead of it.
  const trouble = await play(page).then(
    () => null,
    (error: unknown) => (error instanceof Error ? error.message : String(error)),
  );

  // The file is only finished once the page it is recording is shut, so the take ends here
  // rather than in a hook that runs before the recorder has written its last frame.
  const video = page.video();
  await page.close();
  if (video === null) {
    return;
  }
  await mkdir(OUT, { recursive: true });
  const webm = `${OUT}/demo.webm`;
  await video.saveAs(webm);
  const made = await convert(webm, `${OUT}/demo.mp4`);
  console.log(`docs/demo.webm${made ? " and docs/demo.mp4" : ""}`);
  if (trouble !== null) {
    throw new Error(`the take is saved, but it was cut short: ${trouble}`);
  }
});
