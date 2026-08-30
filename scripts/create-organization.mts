// Provisions a new Organization and its first staff account.
//
// Onboarding is deliberately a script rather than a signup screen
// (docs/adr/0002-multi-tenancy-mvp.md decision 10) — running it by hand a
// few times is what will tell us what a real signup flow should do.
//
//   pnpm org:create "Acme Resale" cs@acme.com "Aung Aung" <password> support_agent
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

// Dynamic, and after loadEnv() — ESM hoists static imports above all other
// top-level code, so a static import would run db/client.ts's
// `if (!DATABASE_URL) throw` before loadEnv() ever populated it.
const { auth } = await import("../src/lib/auth/config");
const { db } = await import("../src/db/client");
const { organizations, members, users } = await import("../src/db/schema");
const { eq } = await import("drizzle-orm");

const [name, email, fullName, password, role = "support_agent"] = process.argv.slice(2);

if (!name || !email || !fullName || !password) {
  console.error(
    'Usage: pnpm org:create "<Organization>" <email> "<Full Name>" <password> [support_agent|supplier]',
  );
  process.exit(1);
}

if (role !== "support_agent" && role !== "supplier") {
  console.error(`Unknown role "${role}" — expected support_agent or supplier.`);
  process.exit(1);
}

const slug = name
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

const [existingOrg] = await db
  .select({ id: organizations.id })
  .from(organizations)
  .where(eq(organizations.slug, slug))
  .limit(1);

if (existingOrg) {
  console.error(`An Organization with slug "${slug}" already exists.`);
  process.exit(1);
}

const [org] = await db.insert(organizations).values({ name, slug }).returning();

// Through better-auth rather than a direct insert, so the credential account
// is written exactly as sign-in expects it (issuer "local:credential",
// providerId "credential") and the password goes through our argon2 hasher.
await auth.api.signUpEmail({ body: { email, password, name: fullName } });

const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
if (!user) throw new Error("user was not created");

await db.insert(members).values({ organizationId: org.id, userId: user.id, role });

console.log(`Organization "${org.name}" (${org.id}), slug "${org.slug}"`);
console.log(`First member: ${email} as ${role}`);
console.log(`\nAdd more staff with:\n  pnpm member:add <email> ${org.slug} <role>`);

process.exit(0);
