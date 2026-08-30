import { config as loadEnv } from "dotenv";

// Vitest doesn't get Next's automatic .env.local loading.
loadEnv({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — tests need a real database. See .env.example");
}

// Guard against the failure mode that would make the whole suite meaningless:
// RLS does not apply to a table's owner, so running these as `neondb_owner`
// would let every isolation assertion pass while proving nothing.
if (/neondb_owner/.test(process.env.DATABASE_URL)) {
  throw new Error(
    "DATABASE_URL points at neondb_owner. RLS is not enforced for the owner role, " +
      "so the isolation tests would pass vacuously. Point it at app_user.",
  );
}
