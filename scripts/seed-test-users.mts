// The actual account-creation mechanism for MVP (docs/PRD.md §4: no
// in-app "add a teammate" screen). Run with `npm run db:seed`.
//
// Creates one Organization and one login per role, if — and only if —
// none exist yet. Safe to re-run; it's a no-op once seeded.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

// Dynamic, and after loadEnv() — ESM hoists static imports above all other
// top-level code, so a static import here would run db/client.ts's
// `if (!DATABASE_URL) throw` before loadEnv() ever populated it.
const { db } = await import("../src/db/client");
const { organizations, users } = await import("../src/db/schema");
const { hashPassword } = await import("../src/lib/auth/hash");

const TEST_PASSWORD = "password123";

async function main() {
  const [existing] = await db.select({ id: organizations.id }).from(organizations).limit(1);
  if (existing) {
    console.log("Already seeded — an Organization already exists. Nothing to do.");
    process.exit(0);
  }

  const [org] = await db.insert(organizations).values({ name: "Test Organization" }).returning();

  const [csPasswordHash, supplierPasswordHash] = await Promise.all([
    hashPassword(TEST_PASSWORD),
    hashPassword(TEST_PASSWORD),
  ]);

  await db.insert(users).values([
    {
      organizationId: org.id,
      name: "Customer Service (test)",
      email: "cs@test.local",
      passwordHash: csPasswordHash,
      role: "customer_service",
    },
    {
      organizationId: org.id,
      name: "Supplier (test)",
      email: "supplier@test.local",
      passwordHash: supplierPasswordHash,
      role: "supplier",
    },
  ]);

  console.log(`Seeded Organization "${org.name}" (${org.id})\n`);
  console.log("Customer Service login:  cs@test.local       /", TEST_PASSWORD);
  console.log("Supplier login:          supplier@test.local /", TEST_PASSWORD);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
