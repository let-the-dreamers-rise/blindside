// One take of the demo, recorded by playing the game. Separate from the test run and from the
// stills, because it is a minute and a quarter of real time and nothing in it asserts.
//
//   pnpm --filter @blindside/app video
//
// Writes docs/demo.mp4 when ffmpeg is on PATH, and leaves the webm beside it either way. There is
// no sound: the beats are paced for the voiceover in docs/VIDEO.md to be read over them.
import { defineConfig, devices } from "@playwright/test";

const SIZE = { width: 1280, height: 720 };

export default defineConfig({
  testDir: "./video",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 300_000,
  use: {
    ...devices["Desktop Chrome"],
    // A take is paced in seconds, so a locator that will never resolve should say so in seconds
    // rather than sit there until the whole test times out.
    actionTimeout: 15_000,
    baseURL: "http://127.0.0.1:4174",
    viewport: SIZE,
    video: { mode: "on", size: SIZE },
  },
  outputDir: "./video-out",
  webServer: {
    command: "pnpm exec vite preview --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
