import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// A four player game built ahead of time by `pnpm --filter @blindside/cli fixture:phone`, so
// the test knows every player's words and who each of them is hunting.
type Player = { readonly name: string; readonly words: string; readonly target: string | null };
type Fixture = { readonly game: string; readonly bundle: string; readonly players: readonly Player[] };

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/phone.json", import.meta.url), "utf8"),
) as Fixture;
const players = fixture.players;

const me = players[0];
const target = players.find((player) => player.name === me?.target);
const bystander = players.find((player) => player !== me && player !== target);

const openPhone = async (page: Page): Promise<void> => {
  await page.goto("/#/me");
  await expect(page.getByRole("heading", { name: "Your phone" })).toBeVisible();
};

const keepWordsAndBundle = async (page: Page, words: string): Promise<void> => {
  await page.getByLabel("The five words you were given").fill(words);
  await page.getByRole("button", { name: "Keep them on this phone" }).click();
  await page.getByLabel("The bundle from the group chat").fill(fixture.bundle);
  await page.getByRole("button", { name: "Read it" }).click();
};

test("a player reads their target out of the bundle with their own words", async ({ page }) => {
  test.setTimeout(90_000);
  if (me === undefined || target === undefined) {
    throw new Error("the fixture has no cycle");
  }
  await openPhone(page);
  await keepWordsAndBundle(page, me.words.toUpperCase());

  const envelope = page.getByRole("button", { name: "Open the envelope" });
  await expect(envelope).toBeVisible({ timeout: 30_000 });
  await envelope.click();
  await expect(page.getByText(target.name, { exact: true })).toBeVisible();

  // Closing the tab loses nothing: the words and the bundle are kept on the phone.
  await page.reload();
  await expect(page.getByRole("button", { name: "Open the envelope" })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Forget everything on this phone" }).click();
  await expect(page.getByLabel("The five words you were given")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open the envelope" })).toHaveCount(0);
});

test("the words you heard are checked the way the contract checks them", async ({ page }) => {
  test.setTimeout(120_000);
  if (me === undefined || target === undefined || bystander === undefined) {
    throw new Error("the fixture has no cycle");
  }
  await openPhone(page);
  await keepWordsAndBundle(page, me.words);
  await page.getByRole("button", { name: "Open the envelope" }).click({ timeout: 30_000 });

  const said = page.getByLabel("What they said");
  const check = page.getByRole("button", { name: "Check what I heard" });

  await said.fill("hello there my old friend");
  await check.click();
  await expect(page.getByRole("alert")).toContainText("not five words");

  await said.fill(bystander.words);
  await check.click();
  await expect(page.getByRole("alert")).toContainText(`not ${target.name}'s`, { timeout: 30_000 });

  await said.fill(target.words);
  await check.click();
  await expect(page.getByRole("status")).toContainText(`That was ${target.name}.`, { timeout: 30_000 });
  await expect(page.getByRole("status")).toContainText(target.words);
});

test("words from another game open nothing", async ({ page }) => {
  test.setTimeout(90_000);
  await openPhone(page);
  await keepWordsAndBundle(page, "abandon ability able about above");
  await expect(page.getByText("Your words open nothing in this bundle")).toBeVisible({ timeout: 30_000 });
});
