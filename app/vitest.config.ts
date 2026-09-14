import { defineConfig } from "vitest/config";

// Only the pure parts of the hunt run here: the grid, the campus, the simulation, the rumours.
// Anything that touches a canvas or a speaker is covered by the browser tests instead.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Argon2id is deliberately slow: building a three player game is a few seconds of work.
    testTimeout: 60_000,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      include: ["src/hunt/**/*.ts", "src/me/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/hunt/art.ts",
        "src/hunt/pixels.ts",
        "src/hunt/paint.ts",
        "src/hunt/audio.ts",
        "src/hunt/useHunt.ts",
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
