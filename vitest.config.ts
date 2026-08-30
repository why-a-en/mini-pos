import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests hit the real Neon database — the tenant boundary is enforced by
// Postgres RLS, so anything that stubs the database out would be testing a
// mock rather than the thing that actually protects a client's data. That
// means DATABASE_URL must point at the `app_user` role: RLS does not apply
// to the owner (see docs/TECH_STACK.md).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // These are round-trips to Singapore, not unit tests.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ["./tests/setup.ts"],
    // The isolation test asserts on rows it creates; parallel files sharing
    // one database would see each other's fixtures.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
