import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs as a standalone CLI, not through Next.js, so it doesn't
// get Next's automatic .env.local loading — load it explicitly.
loadEnv({ path: ".env.local" });

// Migrations use the direct/unpooled connection, not DATABASE_URL — Neon's
// pooled connection runs PgBouncer in transaction mode, which drizzle-kit's
// migration session (multiple statements against one session) isn't
// guaranteed to hold onto. See docs/TECH_STACK.md / the neon-postgres skill.
if (!process.env.DATABASE_URL_UNPOOLED) {
  throw new Error("DATABASE_URL_UNPOOLED is not set — see .env.example");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED,
  },
});
