import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Argon2id is deliberately slow: a handful of key derivations is a few seconds of work.
    testTimeout: 60_000,
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
