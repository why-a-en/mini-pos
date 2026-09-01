// Adds an existing person to another Organization.
//
// This is the script that makes a shared Supplier work — one sourcer buying
// for several resellers, with one login rather than an email address per
// client (docs/adr/0002-multi-tenancy-mvp.md). If the person is new to the
// platform entirely, pass a password and an account is created for them.
//
//   pnpm member:add supplier@example.com acme-resale supplier
//   pnpm member:add newperson@example.com acme-resale supplier "Full Name" <password>
//   pnpm member:add cs@example.com acme-resale support_agent --stores "Main,Yangon Downtown"
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const { auth } = await import("../src/lib/auth/config");
const { db, withOrganizationScope } = await import("../src/db/client");
const { organizations, memberStores, members, stores, users } = await import("../src/db/schema");
const { and, eq } = await import("drizzle-orm");

const argv = process.argv.slice(2);

// `--stores "A,B"` anywhere in the args; omitted means "all of the org's
// stores" (a sane script default — trim later from Settings). The rest are
// positional, unchanged.
let storeNames: string[] | null = null;
const flagAt = argv.indexOf("--stores");
if (flagAt !== -1) {
  storeNames = (argv[flagAt + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  argv.splice(flagAt, 2);
}

const [email, orgSlug, role, fullName, password] = argv;

if (!email || !orgSlug || !role) {
  console.error(
    'Usage: pnpm member:add <email> <organization-slug> <admin|support_agent|supplier> ["Full Name" <password>] [--stores "A,B"]',
  );
  process.exit(1);
}

if (role !== "admin" && role !== "support_agent" && role !== "supplier") {
  console.error(`Unknown role "${role}" — expected admin, support_agent or supplier.`);
  process.exit(1);
}

const [org] = await db
  .select()
  .from(organizations)
  .where(eq(organizations.slug, orgSlug))
  .limit(1);

if (!org) {
  console.error(`No Organization with slug "${orgSlug}".`);
  process.exit(1);
}

let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

if (!user) {
  if (!fullName || !password) {
    console.error(
      `No user with email "${email}". To create one, pass a full name and password as well.`,
    );
    process.exit(1);
  }
  await auth.api.signUpEmail({ body: { email, password, name: fullName } });
  [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error("user was not created");
  console.log(`Created account for ${email}`);
}

const [existing] = await db
  .select({ id: members.id })
  .from(members)
  .where(and(eq(members.userId, user.id), eq(members.organizationId, org.id)))
  .limit(1);

if (existing) {
  console.error(`${email} is already a member of "${org.name}".`);
  process.exit(1);
}

const [member] = await db
  .insert(members)
  .values({ organizationId: org.id, userId: user.id, role })
  .returning({ id: members.id });

// Resolve which Stores to grant. `stores` is RLS-scoped — read it through
// the scope; `member_stores` is exempt.
const orgStores = await withOrganizationScope(org.id, (tx) =>
  tx.select({ id: stores.id, name: stores.name }).from(stores).where(eq(stores.organizationId, org.id)),
);

if (orgStores.length === 0) {
  console.error(
    `"${org.name}" has no stores yet — its Admin needs to create one first (they'll be prompted on next login).`,
  );
  process.exit(1);
}

let grantStores = orgStores;
if (storeNames) {
  grantStores = orgStores.filter((s) => storeNames!.includes(s.name));
  const missing = storeNames.filter((n) => !orgStores.some((s) => s.name === n));
  if (missing.length > 0) {
    console.error(`No store named ${missing.map((m) => `"${m}"`).join(", ")} in "${org.name}".`);
    process.exit(1);
  }
}

await db
  .insert(memberStores)
  .values(grantStores.map((s) => ({ memberId: member.id, storeId: s.id })));

console.log(`Added ${email} to "${org.name}" as ${role}.`);
console.log(`Stores: ${grantStores.map((s) => s.name).join(", ")}`);
console.log("They can switch between Organizations and Stores from Settings.");

process.exit(0);
