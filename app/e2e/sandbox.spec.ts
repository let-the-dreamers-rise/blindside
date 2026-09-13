import { expect, test, type Page } from "@playwright/test";

// Names the sandbox gives the four players who are not you. None of them may ever appear in
// what the page says the chain can see.
const CAST = ["Riya", "Sam", "Nina", "Dev"];

// The other players take their turn on a short timer, so a round is not over when your tag is.
const OTHER_PLAYERS_MOVE_MS = 2_000;

const openSandbox = async (page: Page): Promise<void> => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play a game right now" }).click();
  await expect(page.getByRole("heading", { name: "Sandbox game" })).toBeVisible();
};

const chainPanel = (page: Page) =>
  page.locator("section", {
    has: page.getByRole("heading", { name: "What the chain sees" }),
  });

const targetPanel = (page: Page) =>
  page.locator("section", { has: page.getByRole("heading", { name: "Your target" }) });

const statistic = (page: Page, label: string) =>
  chainPanel(page).locator(".tally > div", { hasText: label }).first();

/** Opens the sealed target and tags whoever it names. Returns the name that was tagged. */
const tagMyTarget = async (page: Page): Promise<string> => {
  await page.getByRole("button", { name: "Open the envelope" }).click();
  const tagButton = page.getByRole("button", { name: /^I tagged / });
  await expect(tagButton).toBeVisible();
  const label = (await tagButton.textContent()) ?? "";
  await tagButton.click();
  return label.replace("I tagged ", "").trim();
};

test("a whole game can be played without a wallet", async ({ page }) => {
  await openSandbox(page);

  await expect(statistic(page, "still in")).toContainText("5");
  await expect(statistic(page, "in the pot")).toContainText("50");

  const claim = page.getByRole("button", { name: "Claim the pot" });
  const envelope = page.getByRole("button", { name: "Open the envelope" });
  const tagged: string[] = [];

  for (let round = 0; round < 5; round += 1) {
    await expect(claim.or(envelope)).toBeVisible();
    if (await claim.isVisible()) {
      break;
    }
    tagged.push(await tagMyTarget(page));
    await page.waitForTimeout(OTHER_PLAYERS_MOVE_MS);
  }

  // Every tag moves the hunter on, so the same target can never come up twice.
  expect(tagged.length).toBeGreaterThan(0);
  expect(new Set(tagged).size).toBe(tagged.length);

  await expect(page.getByText("You won.")).toBeVisible();
  await claim.click();

  await expect(page.getByText("The pot is yours.")).toBeVisible();
  await expect(statistic(page, "in the pot")).toContainText("0");
  await expect(statistic(page, "still in")).toContainText("1");
});

test("the chain panel never names a player", async ({ page }) => {
  await openSandbox(page);

  await tagMyTarget(page);
  await expect(chainPanel(page).getByText("spent").first()).toBeVisible();

  const panel = await chainPanel(page).innerText();
  for (const name of [...CAST, "You"]) {
    expect(panel).not.toContain(name);
  }
});

test("a target stays sealed until it is opened", async ({ page }) => {
  await openSandbox(page);

  await expect(targetPanel(page)).toContainText("sealed to your key");
  for (const name of CAST) {
    await expect(targetPanel(page)).not.toContainText(name);
  }

  await page.getByRole("button", { name: "Open the envelope" }).click();
  await expect(targetPanel(page).getByRole("button", { name: /^I tagged / })).toBeVisible();
});
