import { defineConfig, devices } from "@playwright/test";

// The sandbox is the demo a judge can try without a wallet, so it is the flow worth guarding.
// Tests run against a production build on a phone-sized viewport, which is how it is played.

/** Where the tests point. Set BLINDSIDE_URL to run the whole suite against a deployed site. */
const LOCAL = "http://127.0.0.1:4173";
const deployed = process.env.BLINDSIDE_URL;

// A local preview and a host are not the same thing, and the differences are exactly the ones a
// local run cannot see: an asset that never got uploaded, a cache header that came out wrong, a
// path that needed a rewrite. Pointing the suite at the deployed URL is the only way to know.
const servedLocally = {
  webServer: {
    command: "pnpm exec vite preview --port 4173 --strictPort",
    url: LOCAL,
    reuseExistingServer: process.env.CI === undefined,
    timeout: 120_000,
  },
} as const;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI !== undefined ? 1 : 0,
  reporter: process.env.CI !== undefined ? "github" : "list",
  timeout: 60_000,
  use: {
    baseURL: deployed ?? LOCAL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "phone",
      use: { ...devices["Pixel 7"] },
    },
  ],
  ...(deployed === undefined ? servedLocally : {}),
});
