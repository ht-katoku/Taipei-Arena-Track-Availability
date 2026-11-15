import { defineConfig } from "vitest/config";

// Phase 1 runs plain Vitest. @cloudflare/vitest-pool-workers is added in
// Phase 3, when tests first need a local D1 (see docs/decisions.md, L-1).
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
