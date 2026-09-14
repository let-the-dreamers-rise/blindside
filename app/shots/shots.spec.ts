// Every picture the submission and the video need, taken by playing the game rather than by
// mocking it up. Nothing in here asserts: if the game changes, the pictures change with it.
// SPDX-License-Identifier: Apache-2.0

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { type Page, test } from "@playwright/test";

const OUT = resolve(process.cwd(), "../docs/shots");

const shoot = async (page: Page, name: string, project: string): Promise<void> => {
  const file = `${OUT}/${project}/${name}.png`;
  await mkdir(dirname(file), { recursive: true });
  // Typing into the form scrolls the page, and every picture here is of the map and the bar
  // under it, so every picture starts from the top.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(120);
  await page.screenshot({ path: file });
};

/** The stage settles a beat after a click: people take a step, the camera catches up. */
const settle = async (page: Page, ms = 900): Promise<void> => {
  await page.waitForTimeout(ms);
};

/**
 * A new game, from wherever the page already is. The query string is what makes it a new page:
 * changing only the hash moves the address bar and nothing else, which is also true for anybody
 * pasting a shared link into a tab that is already playing.
 */
let take = 0;

const openHunt = async (page: Page, seed: number, place: string): Promise<void> => {
  // The query string is what makes it a load. It has to differ every time as well: navigating to
  // the URL the page is already on changes nothing, so a second game on the same seed would
  // quietly carry on being the first one.
  take += 1;
  await page.goto(`/?shot=${seed}-${take}#/hunt?seed=${seed}&players=8&place=${place}`);
  await page.getByRole("heading", { name: "One of them is hunting you." }).waitFor();
};

/** Walks up to the named person the way a player does: tap them, wait, tap again. */
const walkUpTo = async (page: Page, name: string): Promise<boolean> => {
  const tag = page.getByRole("button", { name: `Tag ${name}` });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const walk = page.getByRole("button", { name: `Walk to ${name}` });
    if (await walk.count()) {
      await walk.dispatchEvent("click");
    }
    if (await tag.isEnabled()) {
      return true;
    }
    await page.waitForTimeout(300);
  }
  return false;
};

test("the front page", async ({ page }, info) => {
  await page.goto("/#/");
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  await settle(page, 600);
  await shoot(page, "00-the-front", info.project.name);
});

test("the choices, the campus, the moment, the chain and the park", async ({ page }, info) => {
  const project = info.project.name;

  await openHunt(page, 77, "campus");
  await shoot(page, "01-choose", project);

  await page.getByRole("button", { name: "Practice first" }).click();
  await page.getByRole("button", { name: "Open the envelope" }).click();
  await settle(page, 1_400);
  await shoot(page, "02-campus", project);

  const name = (await page.locator(".hud-row strong").first().innerText()).trim();
  if (await walkUpTo(page, name)) {
    await page.getByRole("button", { name: `Tag ${name}` }).click();
    await settle(page, 700);
    await shoot(page, "03-the-moment", project);

    const bubble = page.getByTestId("bubble");
    if (await bubble.isVisible()) {
      await page.getByLabel("What they said").fill((await bubble.innerText()).trim());
      await page.locator("form").getByRole("button", { name: `Tag ${name}` }).click();
      await settle(page, 2_600);
    }
  }

  // A fresh game for this one, and a wait for somebody to be tagged out there, because the
  // picture is about a count that moves while the list of people does not. Doing it off the back
  // of the tag above made the frame depend on whether that tag landed.
  await openHunt(page, 77, "campus");
  await page.getByRole("button", { name: "Practice first" }).click();
  await page.getByRole("button", { name: "Open the envelope" }).click();
  // Somebody, somewhere on the campus, gets tagged. If nobody does in time the picture is still
  // worth having, so this waits rather than asserts.
  await page
    .getByText(/ is out\./)
    .first()
    .waitFor({ timeout: 60_000 })
    .catch(() => undefined);
  await page.getByRole("button", { name: "The chain", exact: true }).click();
  await settle(page, 400);
  await shoot(page, "04-the-chain", project);
  await page.getByRole("button", { name: "Back to the map" }).click();

  await openHunt(page, 5, "park");
  await page.getByRole("button", { name: "Start the hunt" }).click();
  await settle(page, 1_400);
  await shoot(page, "05-the-park", project);

  // Last, because it is the only one that costs two minutes, and in practice because a hunt you
  // are not playing takes about thirty-five seconds to end with somebody standing behind you.
  await openHunt(page, 31, "campus");
  await page.getByRole("button", { name: "Practice first" }).click();
  await page.waitForTimeout(115_000);
  await shoot(page, "06-the-grounds-close", project);
});
