import { expect, test, type Page } from "@playwright/test";

// The claim on the front page is that the pot can always leave the contract. This walks the
// path a game takes when it falls apart and checks the money really comes back.

const openSandbox = async (page: Page): Promise<void> => {
  await page.goto("/");
  await page.getByRole("link", { name: /The paper version/ }).click();
  await expect(page.getByRole("heading", { name: "Sandbox game" })).toBeVisible();
};

const pot = (page: Page) =>
  page
    .locator("section", { has: page.getByRole("heading", { name: "What the chain sees" }) })
    .locator(".tally > div", { hasText: "in the pot" })
    .first();

test("a game nobody finishes gives everyone their fee back", async ({ page }) => {
  await openSandbox(page);
  await expect(pot(page)).toContainText("50");

  await page.getByRole("button", { name: "Nobody tags anyone again" }).click();
  await page.getByRole("button", { name: "Open refunds" }).click();

  await expect(page.getByText("Nobody won this one.")).toBeVisible();
  await expect(pot(page)).toContainText("50");

  await page.getByRole("button", { name: "Everyone takes their fee back" }).click();

  await expect(pot(page)).toContainText("0");
  await expect(page.getByText("Pot empty. Nobody lost anything.")).toBeVisible();
});

test("quitting leaves a code and nothing else", async ({ page }) => {
  await openSandbox(page);

  await page.getByRole("button", { name: "I want out of this game" }).click();

  await expect(page.getByText("You left a dead drop.")).toBeVisible();
  // Quitting is not a way to take money out, and it does not end anyone else's game.
  await expect(pot(page)).toContainText("50");
  await expect(page.getByRole("button", { name: "I want out of this game" })).toHaveCount(0);
});

test("refunds cannot be opened before the deadline", async ({ page }) => {
  await openSandbox(page);

  await expect(page.getByRole("button", { name: "Open refunds" })).toBeDisabled();
});
