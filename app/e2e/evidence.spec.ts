import { expect, test } from "@playwright/test";

// The evidence page is built from the file the local-chain runner writes, so if the run ever
// stops producing transaction identifiers this fails rather than quietly showing dashes.

test("the evidence page shows a finished game with its transactions", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "See it on a real chain" }).click();

  await expect(page.getByRole("heading", { name: "A real game, on a real chain" })).toBeVisible();

  const rows = page.locator(".receipts tbody tr");
  await expect(rows).not.toHaveCount(0);

  for (const label of ["deploy", "start game", "claim victory"]) {
    const row = rows.filter({ hasText: label }).first();
    await expect(row).toBeVisible();
    await expect(row.locator("td").last()).not.toHaveText("-");
  }

  // A finished game has paid out, so nothing is left in the contract.
  await expect(page.locator(".tally > div", { hasText: "left in the pot" })).toContainText("0");
});
