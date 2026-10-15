import { defineConfig } from "vitest/config";

// Some tests start a small in-memory database. Running too many at once runs a laptop out of memory,
// so at most 2 test files run at the same time, and a slow test gets 30 seconds.
export default defineConfig({
  test: {
    maxWorkers: 2,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
