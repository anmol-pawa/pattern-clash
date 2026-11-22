import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["lib/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
    // Judge tests compile real C++ with native g++/clang++ (several binaries per test on Windows).
    testTimeout: 60_000,
    coverage: {
      provider: "v8",
      include: ["lib/battle/**/*.ts"],
      exclude: ["lib/battle/**/*.test.ts", "lib/battle/fixtures.ts", "lib/battle/index.ts", "lib/battle/types.ts"],
      reporter: ["text"],
      thresholds: {
        // Crown rules decide the result of every battle: every branch is pinned (ROADMAP P1.1).
        "lib/battle/crowns.ts": { branches: 100, functions: 100, lines: 100, statements: 100 },
      },
    },
  },
});
