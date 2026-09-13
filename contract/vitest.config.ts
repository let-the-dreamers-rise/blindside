import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/test/**/*.test.ts"],
    // Every move in a property sweep runs a real circuit, which is far slower than a unit test.
    testTimeout: 120_000,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      // The generated contract bindings and proving keys are compiler output, not our code.
      include: ["src/simulator.ts", "src/witnesses.ts", "src/index.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
