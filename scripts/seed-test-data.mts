// Idempotent test-data seed — the accounts the login page's dev helper
// lists. Run it as often as you like; it converges to the state below.
//
//   pnpm tsx scripts/seed-test-data.mts
//
// Scenarios covered (all password `password123`):
//
//   admin@test.local     Test Organization · admin · Main + Warehouse
//                        -> /select-store on first login, then the Store
//                           switcher in Settings
//   cs@test.local        Test Organization · support_agent · Main only
//                        -> straight in, no switcher
//   packer@test.local    Test Organization · support_agent · Warehouse only
//                        -> straight in, lands on the non-default Store
//   supplier@test.local  Test Organization (Main + Warehouse) AND
//                        Second Reseller (Main) · supplier
//                        -> both the Organization and the Store switcher
//   orphan@test.local    Test Organization · support_agent · no Stores
//                        -> /select-store dead-end ("ask your Admin")
//   cs2@test.local       Second Reseller · support_agent · Main
//   founder@test.local   Fresh Co · admin · org has NO Store
//                        -> /onboarding on first login
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const { auth } = await import("../src/lib/auth/config");
const { db, withOrganizationScope } = await import("../src/db/client");
const { organizations, memberStores, members, sessions, stores, users } = await import("../src/db/schema");
const { and, eq, inArray } = await import("drizzle-orm");

const PASSWORD = "password123";

// --- helpers --------------------------------------------------------------

async function ensureOrg(name: string, slug: string): Promise<string> {
  const [existing] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  if (existing) return existing.id;
  const [org] = await db.insert(organizations).values({ name, slug }).returning({ id: organizations.id });
  console.log(`+ org "${name}"`);
  return org.id;
}

async function ensureStore(orgId: string, name: string): Promise<string> {
  const rows = await withOrganizationScope(orgId, (tx) =>
    tx.select().from(stores).where(eq(stores.organizationId, orgId)),
  );
  const hit = rows.find((s) => s.name === name);
  if (hit) return hit.id;
  const [store] = await withOrganizationScope(orgId, (tx) =>
    tx.insert(stores).values({ organizationId: orgId, name }).returning({ id: stores.id }),
  );
  console.log(`  + store "${name}"`);
  return store.id;
}

async function ensureUser(email: string, fullName: string): Promise<string> {
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return existing.id;
  // Through better-auth so the credential account matches sign-in exactly.
  await auth.api.signUpEmail({ body: { email, password: PASSWORD, name: fullName } });
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error(`failed to create ${email}`);
  console.log(`  + user ${email}`);
  return user.id;
}

/** Upserts the membership and sets its Store grants to exactly `storeIds`. */
async function grant(orgId: string, userId: string, role: string, storeIds: string[]) {
  let [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.organizationId, orgId)))
    .limit(1);
  if (!member) {
    [member] = await db
      .insert(members)
      .values({ organizationId: orgId, userId, role })
      .returning({ id: members.id });
  } else {
    await db.update(members).set({ role }).where(eq(members.id, member.id));
  }
  await db.delete(memberStores).where(eq(memberStores.memberId, member.id));
  if (storeIds.length > 0) {
    await db.insert(memberStores).values(storeIds.map((storeId) => ({ memberId: member.id, storeId })));
  }
}

// --- cleanup: leftover test-run orgs (staff-*, orders-*, isolation-*) -----

const junk = (await db.select().from(organizations)).filter((o) =>
  /^(staff|orders|isolation)-\d+/.test(o.slug),
);
for (const o of junk) {
  const mem = await db.select({ id: members.id }).from(members).where(eq(members.organizationId, o.id));
  if (mem.length > 0) {
    await db.delete(memberStores).where(inArray(memberStores.memberId, mem.map((m) => m.id)));
  }
  await db.delete(members).where(eq(members.organizationId, o.id));
  await withOrganizationScope(o.id, (tx) => tx.delete(stores).where(eq(stores.organizationId, o.id)));
  await db.delete(organizations).where(eq(organizations.id, o.id));
  console.log(`- cleaned leftover org "${o.slug}"`);
}

// --- Test Organization: two stores, the full spread of scenarios ---------

const testOrg = await ensureOrg("Test Organization", "test-organization");
const tMain = await ensureStore(testOrg, "Main");
const tWarehouse = await ensureStore(testOrg, "Warehouse");

await grant(testOrg, await ensureUser("admin@test.local", "Test Admin"), "admin", [tMain, tWarehouse]);
await grant(testOrg, await ensureUser("cs@test.local", "Test Support"), "support_agent", [tMain]);
await grant(testOrg, await ensureUser("packer@test.local", "Test Packer"), "support_agent", [tWarehouse]);
await grant(testOrg, await ensureUser("orphan@test.local", "No Store"), "support_agent", []);

// --- Second Reseller: shared supplier + its own support agent ------------

const secondOrg = await ensureOrg("Second Reseller", "second-reseller");
const sMain = await ensureStore(secondOrg, "Main");

const supplierId = await ensureUser("supplier@test.local", "Shared Supplier");
await grant(testOrg, supplierId, "supplier", [tMain, tWarehouse]);
await grant(secondOrg, supplierId, "supplier", [sMain]);
await grant(secondOrg, await ensureUser("cs2@test.local", "Second Support"), "support_agent", [sMain]);

// --- Fresh Co: an Organization with NO store, to hit /onboarding --------

const freshOrg = await ensureOrg("Fresh Co", "fresh-co");
await grant(freshOrg, await ensureUser("founder@test.local", "Fresh Founder"), "admin", []);
// Deliberately NO store — that's the scenario. Reset it every run in case a
// previous run's founder completed onboarding and created one.
const freshStores = await withOrganizationScope(freshOrg, (tx) =>
  tx.select({ id: stores.id }).from(stores).where(eq(stores.organizationId, freshOrg)),
);
if (freshStores.length > 0) {
  const ids = freshStores.map((s) => s.id);
  // sessions.active_store_id is ON DELETE NO ACTION — clear any that point
  // here before dropping the stores. member_stores cascades on its own.
  await db.update(sessions).set({ activeStoreId: null }).where(inArray(sessions.activeStoreId, ids));
  await withOrganizationScope(freshOrg, (tx) => tx.delete(stores).where(inArray(stores.id, ids)));
}

console.log("\nDone.");
process.exit(0);
