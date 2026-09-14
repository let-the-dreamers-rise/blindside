import { expect, test, type Page } from "@playwright/test";

// The seven people who are not you. None of them may ever appear in what the chain sees.
const CAST = ["Riya", "Sam", "Nina", "Dev", "Tara", "Kabir", "Zoe"];

const openHunt = async (page: Page, seed: number): Promise<void> => {
  await page.goto(`/#/hunt?seed=${seed}`);
  await expect(page.getByRole("heading", { name: "One of them is hunting you." })).toBeVisible();
};

const chainPanel = (page: Page) =>
  page.locator("section", { has: page.getByRole("heading", { name: "What the chain sees" }) });

const statistic = (page: Page, label: string) =>
  chainPanel(page).locator(".tally > div", { hasText: label }).first();

const myTarget = async (page: Page): Promise<string> => {
  await page.getByRole("button", { name: "Open the envelope" }).click();
  const hud = page.locator(".hud-row", { hasText: "Your target" });
  await expect(hud).toBeVisible();
  return (await hud.locator("strong").first().innerText()).trim();
};

/**
 * Taps the target, which makes you follow them as they wander, until you are next to them.
 * The tap is dispatched rather than clicked because a person mid-step never holds still long
 * enough for Playwright to call them stable.
 */
const walkUpTo = async (page: Page, name: string): Promise<void> => {
  const tag = page.getByRole("button", { name: `Tag ${name}` });
  await expect
    .poll(
      async () => {
        const walk = page.getByRole("button", { name: `Walk to ${name}` });
        if (await walk.count()) {
          await walk.dispatchEvent("click");
        }
        return tag.isEnabled();
      },
      { timeout: 90_000, intervals: [500] },
    )
    .toBe(true);
};

/**
 * Walks up to the target and tags them: they stop, the five words appear in their speech
 * bubble, and what you type is checked by the real contract. Returns the name that was tagged.
 */
const tagMyTarget = async (page: Page): Promise<string> => {
  const name = await myTarget(page);
  await walkUpTo(page, name);
  await page.getByRole("button", { name: `Tag ${name}` }).click();

  const bubble = page.getByTestId("bubble");
  await expect(bubble).toBeVisible();
  const words = (await bubble.innerText()).trim();
  expect(words.split(/\s+/)).toHaveLength(5);
  await page.getByLabel("What they said").fill(words);
  await page.locator("form").getByRole("button", { name: `Tag ${name}` }).click();
  return name;
};

test("a whole hunt can be played and won without a wallet", async ({ page }) => {
  test.setTimeout(240_000);
  await openHunt(page, 11);
  await page.getByRole("button", { name: "Practice first" }).click();

  await expect(statistic(page, "still in")).toContainText("8");
  await expect(statistic(page, "in the pot")).toContainText("80");

  const tagged: string[] = [];
  for (let round = 0; round < 8; round += 1) {
    const claim = page.getByRole("button", { name: "Claim the pot" });
    if (await claim.isVisible()) {
      break;
    }
    const before = Number((await statistic(page, "still in").locator("strong").innerText()).trim());
    tagged.push(await tagMyTarget(page));
    await expect(statistic(page, "still in")).not.toContainText(String(before));
  }

  expect(tagged.length).toBeGreaterThan(0);
  expect(new Set(tagged).size).toBe(tagged.length);
  await expect(page.getByText("You won.")).toBeVisible();
  await page.getByRole("button", { name: "Claim the pot" }).click();
  await expect(page.getByText("The pot is yours.")).toBeVisible();
  await expect(statistic(page, "in the pot")).toContainText("0");
});

test("the chain panel never names a player, whatever the campus saw", async ({ page }) => {
  test.setTimeout(120_000);
  await openHunt(page, 12);
  await page.getByRole("button", { name: "Practice first" }).click();
  await tagMyTarget(page);
  await expect(chainPanel(page).getByText("spent").first()).toBeVisible();

  const panel = await chainPanel(page).innerText();
  for (const name of [...CAST, "You"]) {
    expect(panel).not.toContain(name);
  }
});

test("the wrong five words are refused by the contract, not by the page", async ({ page }) => {
  test.setTimeout(120_000);
  await openHunt(page, 13);
  await page.getByRole("button", { name: "Practice first" }).click();
  const name = await myTarget(page);
  await walkUpTo(page, name);
  await page.getByRole("button", { name: `Tag ${name}` }).click();

  const said = page.getByLabel("What they said");
  await said.fill("abandon ability able about above");
  await page.locator("form").getByRole("button", { name: `Tag ${name}` }).click();
  await expect(page.getByRole("alert")).toContainText("not your target");
  await expect(statistic(page, "still in")).toContainText("8");
});

test("standing still gets you caught, and being caught is a real tag", async ({ page }) => {
  test.setTimeout(180_000);
  await openHunt(page, 14);
  await page.getByRole("button", { name: "Start the hunt" }).click();

  await expect(page.getByText(/got you\.$/)).toBeVisible({ timeout: 150_000 });
  await page.getByRole("button", { name: "Say my words" }).click();
  await expect(page.getByTestId("your-bubble")).toBeVisible();
  await expect(page.getByText("You are out. Watching the rest.")).toBeVisible({ timeout: 10_000 });
  // Your tag took you out, and once you are out the others tag freely, so seven at most.
  await expect(statistic(page, "still in")).not.toContainText("8");
  await expect(page.locator(".hud").getByText("Out", { exact: true })).toBeVisible();
});
