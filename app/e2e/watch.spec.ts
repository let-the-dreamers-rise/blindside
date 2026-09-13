import { expect, test } from "@playwright/test";

// Watching a real game needs a real chain, which CI does not have. What is checked here is that
// the page refuses bad input before it touches the network, and says something useful when the
// chain is not there.

test("a malformed address is rejected without a network call", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/v3/graphql", async (route) => {
    calls += 1;
    await route.abort();
  });

  await page.goto("/#/watch");
  await page.getByLabel("Contract address").fill("not-an-address");
  await page.getByRole("button", { name: "Watch this game" }).click();

  await expect(page.getByText("A contract address is 64 hex characters.")).toBeVisible();
  expect(calls).toBe(0);
});

test("an unreachable chain says so instead of hanging", async ({ page }) => {
  await page.route("**/api/v3/graphql", (route) => route.abort());

  await page.goto("/#/watch");
  await page.getByLabel("Contract address").fill("a".repeat(64));
  await page.getByRole("button", { name: "Watch this game" }).click();

  await expect(page.getByText("Could not reach that indexer")).toBeVisible();
});

test("a game the chain has never heard of is not an error", async ({ page }) => {
  await page.route("**/api/v3/graphql", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { contractAction: null } }),
    }),
  );

  await page.goto("/#/watch");
  await page.getByLabel("Contract address").fill("b".repeat(64));
  await page.getByRole("button", { name: "Watch this game" }).click();

  await expect(page.getByText("No contract at that address on this network.")).toBeVisible();
});
