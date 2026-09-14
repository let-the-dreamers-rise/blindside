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
 * Presses Tag, and presses it again if the target wandered out of reach between the button
 * lighting up and the press landing. A person walks away from you; a test has to allow for it.
 */
const openTheMoment = async (page: Page, name: string): Promise<void> => {
  const said = page.getByLabel("What they said");
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await walkUpTo(page, name);
    await page.getByRole("button", { name: `Tag ${name}` }).click();
    if (await said.isVisible({ timeout: 1_500 }).catch(() => false)) {
      return;
    }
  }
  throw new Error(`never got close enough to ${name}`);
};

/**
 * Walks up to the target and tags them: they stop, the five words appear in their speech
 * bubble, and what you type is checked by the real contract. Returns the name that was tagged.
 */
const tagMyTarget = async (page: Page): Promise<string> => {
  const name = await myTarget(page);
  await openTheMoment(page, name);

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

test("the chain's eye is the same moment with everything identifying taken out", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await openHunt(page, 17);
  await page.getByRole("button", { name: "Practice first" }).click();

  const eye = page.getByRole("region", { name: "What the chain sees" });
  const pseudonyms = eye.getByTestId("chain-players").locator(".chain-card");

  await page.getByRole("button", { name: "The chain", exact: true }).click();
  await expect(eye).toBeVisible();
  await expect(pseudonyms).toHaveCount(8);
  await expect(eye.getByTestId("chain-spent")).toContainText("nothing retired yet");
  await page.getByRole("button", { name: "Back to the map" }).click();
  await expect(eye).toBeHidden();

  await tagMyTarget(page);
  await page.getByRole("button", { name: "The chain", exact: true }).click();

  // A tag retires two notes and changes the count of who is left. It changes nothing about the
  // list of players, because that list is the whole of what the chain knows about people.
  await expect(eye.getByTestId("chain-spent").locator(".chain-card")).toHaveCount(2);
  await expect(pseudonyms).toHaveCount(8);
  await expect(eye.getByText(/is out, and the count above says so/)).toBeVisible();

  const seen = await eye.innerText();
  for (const name of [...CAST, "You"]) {
    expect(seen).not.toContain(name);
  }
});

test("the wrong five words are refused by the contract, not by the page", async ({ page }) => {
  test.setTimeout(120_000);
  await openHunt(page, 13);
  await page.getByRole("button", { name: "Practice first" }).click();
  const name = await myTarget(page);
  await openTheMoment(page, name);

  const said = page.getByLabel("What they said");
  await said.fill("abandon ability able about above");
  await page.locator("form").getByRole("button", { name: `Tag ${name}` }).click();
  await expect(page.getByRole("alert")).toContainText("not your target");
  await expect(statistic(page, "still in")).toContainText("8");
});

test("a game is a link: the seed and the size go in the address bar", async ({ page }) => {
  await page.goto("/#/hunt");
  await page.getByRole("button", { name: "Practice first" }).click();
  await expect(page).toHaveURL(/#\/hunt\?seed=\d+&players=8/);
});

test("a link to a game opens that game, even mid-hunt", async ({ page }) => {
  await openHunt(page, 21);
  await page.getByRole("button", { name: "Practice first" }).click();
  await expect(page.getByRole("button", { name: "Open the envelope" })).toBeVisible();

  await page.evaluate(() => {
    window.location.hash = "#/hunt?seed=22&players=4&place=park";
  });

  await expect(page.getByRole("heading", { name: "One of them is hunting you." })).toBeVisible();
  await page.getByRole("button", { name: "Practice first" }).click();
  await expect(page).toHaveURL(/seed=22&players=4&place=park/);
});

test("the other place is a different map with its own buildings", async ({ page }) => {
  await openHunt(page, 19);
  await page.getByRole("group", { name: "Where you are playing" }).getByText("The park").click();
  // Not practice: practice takes the roofs off, and the roofs are what carry the names.
  await page.getByRole("button", { name: "Start the hunt" }).click();

  await expect(page).toHaveURL(/place=park/);
  await expect(page.getByText("Bandstand")).toBeVisible();
  await expect(page.getByText("Boathouse")).toBeVisible();
  await expect(page.getByText("Library")).toHaveCount(0);
});

test("a smaller game is a smaller game all the way down to the contract", async ({ page }) => {
  await openHunt(page, 18);
  await page.getByRole("group", { name: "How many are playing" }).getByText("4").click();
  await page.getByRole("button", { name: "Practice first" }).click();

  await expect(page).toHaveURL(/players=4/);
  // Three people to walk to, four staked entries in the pot, four pseudonyms on the record.
  await expect(page.getByRole("button", { name: /^Walk to / })).toHaveCount(3);
  await expect(statistic(page, "in the pot")).toContainText("40");
  await expect(statistic(page, "still in")).toContainText("4");

  await page.getByRole("button", { name: "The chain", exact: true }).click();
  const eye = page.getByRole("region", { name: "What the chain sees" });
  await expect(eye.getByTestId("chain-players").locator(".chain-card")).toHaveCount(4);
});

test("the campus is full of people who are not in the game", async ({ page }) => {
  await openHunt(page, 15);
  await page.getByRole("button", { name: "Practice first" }).click();

  // Ten strangers, none of them tappable and none of them named: eight players, no more.
  await expect(page.locator(".actor.stranger")).toHaveCount(10);
  await expect(page.locator(".actor.stranger").first()).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByRole("button", { name: /^Walk to / })).toHaveCount(7);
});

test("running spends your breath and walking gets it back", async ({ page }) => {
  test.setTimeout(90_000);
  await openHunt(page, 16);
  await page.getByRole("button", { name: "Practice first" }).click();

  const breath = page.getByRole("progressbar", { name: "Breath" });
  const now = async (): Promise<number> => Number(await breath.getAttribute("aria-valuenow"));
  await expect(breath).toHaveAttribute("aria-valuenow", "100");

  // Held down together, because running on the spot costs nothing. The campus is only so wide,
  // so this asks for a clear drain rather than an empty bar.
  const run = page.getByRole("button", { name: "Run" });
  const west = page.getByRole("button", { name: "Walk left" });
  await west.dispatchEvent("pointerdown");
  await run.dispatchEvent("pointerdown");
  await expect.poll(now, { timeout: 30_000 }).toBeLessThan(85);

  await run.dispatchEvent("pointerup");
  const spent = await now();
  await expect.poll(now, { timeout: 30_000 }).toBeGreaterThan(spent);
  await west.dispatchEvent("pointerup");
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
