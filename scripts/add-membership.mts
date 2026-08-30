// Adds an existing person to another Organization.
//
// This is the script that makes a shared Supplier work — one sourcer buying
// for several resellers, with one login rather than an email address per
// client (docs/adr/0002-multi-tenancy-mvp.md). If the person is new to the
// platform entirely, pass a password and an account is created for them.
//
//   pnpm member:add supplier@example.com acme-resale supplier
//   pnpm member:add newperson@example.com acme-resale supplier "Full Name" <password>
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const { auth } = await import("../src/lib/auth/config");
const { db } = await import("../src/db/client");
const { organizations, members, users } = await import("../src/db/schema");
const { and, eq } = await import("drizzle-orm");

const [email, orgSlug, role, fullName, password] = process.argv.slice(2);

if (!email || !orgSlug || !role) {
  console.error(
    "Usage: pnpm member:add <email> <organization-slug> <customer_service|supplier> [\"Full Name\" <password>]",
  );
  process.exit(1);
}

if (role !== "customer_service" && role !== "supplier") {
  console.error(`Unknown role "${role}" — expected customer_service or supplier.`);
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

await db.insert(members).values({ organizationId: org.id, userId: user.id, role });

console.log(`Added ${email} to "${org.name}" as ${role}.`);
console.log("They can switch between Organizations from Settings.");

process.exit(0);
