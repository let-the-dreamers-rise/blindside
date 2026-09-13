import { defineConfig, devices } from "@playwright/test";

// The sandbox is the demo a judge can try without a wallet, so it is the flow worth guarding.
// Tests run against a production build on a phone-sized viewport, which is how it is played.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI !== undefined ? 1 : 0,
  reporter: process.env.CI !== undefined ? "github" : "list",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "phone",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: "pnpm exec vite preview --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: process.env.CI === undefined,
    timeout: 120_000,
  },
});
