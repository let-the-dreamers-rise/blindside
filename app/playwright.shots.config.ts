// Pictures of the game, taken by playing it. Kept out of the test run because a screenshot is
// not a test: nothing here asserts anything, and it takes minutes rather than seconds.
//
//   pnpm --filter @blindside/app shots
//
// Writes to docs/shots. Run it after a change worth showing somebody.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./shots",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 300_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1180, height: 860 } } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "pnpm exec vite preview --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
