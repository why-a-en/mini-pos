// Provisions a new Organization and its first staff account.
//
// Onboarding is deliberately a script rather than a signup screen
// (docs/adr/0002-multi-tenancy-mvp.md decision 10) — running it by hand a
// few times is what will tell us what a real signup flow should do.
//
//   pnpm org:create "Acme Resale" cs@acme.com "Aung Aung" <password> support_agent "Main"
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

// Dynamic, and after loadEnv() — ESM hoists static imports above all other
// top-level code, so a static import would run db/client.ts's
// `if (!DATABASE_URL) throw` before loadEnv() ever populated it.
const { auth } = await import("../src/lib/auth/config");
const { db, withOrganizationScope } = await import("../src/db/client");
const { organizations, memberStores, members, stores, users } = await import("../src/db/schema");
const { eq } = await import("drizzle-orm");

const [name, email, fullName, password, role = "support_agent", storeName = "Main"] =
  process.argv.slice(2);

if (!name || !email || !fullName || !password) {
  console.error(
    'Usage: pnpm org:create "<Organization>" <email> "<Full Name>" <password> [admin|support_agent|supplier] [store name]',
  );
  process.exit(1);
}

if (role !== "admin" && role !== "support_agent" && role !== "supplier") {
  console.error(`Unknown role "${role}" — expected admin, support_agent or supplier.`);
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

const [member] = await db
  .insert(members)
  .values({ organizationId: org.id, userId: user.id, role })
  .returning({ id: members.id });

// Every Organization needs at least one Store — an Order can't be logged
// without one. `stores` is RLS-scoped, so this insert goes through the
// scope; `member_stores` is exempt and grants the first member access so
// they aren't stranded at /select-store on first login.
const [store] = await withOrganizationScope(org.id, (tx) =>
  tx.insert(stores).values({ organizationId: org.id, name: storeName }).returning({ id: stores.id }),
);
await db.insert(memberStores).values({ memberId: member.id, storeId: store.id });

console.log(`Organization "${org.name}" (${org.id}), slug "${org.slug}"`);
console.log(`First member: ${email} as ${role}`);
console.log(`First store: "${storeName}" (${store.id})`);
console.log(`\nAdd more staff with:\n  pnpm member:add <email> ${org.slug} <role>`);

process.exit(0);
