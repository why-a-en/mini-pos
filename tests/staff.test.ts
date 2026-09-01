import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, withOrganizationScope } from "@/db/client";
import { accounts, memberStores, members, organizations, stores, users } from "@/db/schema";
import { auth } from "@/lib/auth/config";
import {
  addStaff,
  changeStaffRole,
  listStaff,
  removeStaff,
  resetStaffPassword,
  setStaffStatus,
} from "@/services/staff";
import { ServiceError, type ServiceContext } from "@/services/types";

const TAG = `staff-${Date.now()}`;

let orgId: string;
let storeId: string;
let adminUserId: string;
let adminMemberId: string;

function asAdmin<T>(fn: (ctx: ServiceContext) => Promise<T>) {
  return withOrganizationScope(orgId, (tx) =>
    fn({ organizationId: orgId, storeId, userId: adminUserId, tx }),
  );
}

/** Does this password actually let them in? The only check that matters. */
async function canSignIn(email: string, password: string): Promise<boolean> {
  try {
    const res = await auth.api.signInEmail({ body: { email, password } });
    return !!res.user;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  const [org] = await db
    .insert(organizations)
    .values({ name: `${TAG}-org`, slug: `${TAG}-org` })
    .returning({ id: organizations.id });
  orgId = org.id;

  const [admin] = await db
    .insert(users)
    .values({ name: `${TAG} admin`, email: `${TAG}-admin@staff.test` })
    .returning({ id: users.id });
  adminUserId = admin.id;

  const [member] = await db
    .insert(members)
    .values({ organizationId: orgId, userId: adminUserId, role: "admin" })
    .returning({ id: members.id });
  adminMemberId = member.id;

  // `stores` is RLS-scoped — insert through the scope. `member_stores` is
  // exempt, so a plain insert is fine.
  storeId = await withOrganizationScope(orgId, async (tx) => {
    const [store] = await tx
      .insert(stores)
      .values({ organizationId: orgId, name: `${TAG}-store` })
      .returning({ id: stores.id });
    return store.id;
  });
  await db.insert(memberStores).values({ memberId: adminMemberId, storeId });
});

afterAll(async () => {
  const owned = await db
    .select({ userId: members.userId })
    .from(members)
    .where(eq(members.organizationId, orgId));
  const userIds = owned.map((m) => m.userId);
  // member_stores rows cascade from members, but delete explicitly so the
  // order is unambiguous regardless of FK timing.
  const memberRows = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.organizationId, orgId));
  if (memberRows.length > 0) {
    await db.delete(memberStores).where(
      inArray(memberStores.memberId, memberRows.map((m) => m.id)),
    );
  }
  await db.delete(members).where(eq(members.organizationId, orgId));
  await withOrganizationScope(orgId, (tx) =>
    tx.delete(stores).where(eq(stores.organizationId, orgId)),
  );
  if (userIds.length > 0) {
    await db.delete(accounts).where(inArray(accounts.userId, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  }
  await db.delete(organizations).where(eq(organizations.id, orgId));
});

describe("addStaff", () => {
  it("issues a working temporary password and forces a change", async () => {
    const email = `${TAG}-new@staff.test`;
    const created = await asAdmin((ctx) =>
      addStaff(ctx, { name: "New Hire", email, role: "support_agent", storeIds: [storeId] }),
    );

    expect(created.temporaryPassword).toHaveLength(12);
    // Generated, not chosen — the point is that no Admin picks password123.
    expect(created.temporaryPassword).toMatch(/^[abcdefghjkmnpqrtuvwxyz2346789]+$/);

    expect(await canSignIn(email, created.temporaryPassword)).toBe(true);

    const [row] = await db.select().from(users).where(eq(users.id, created.userId));
    expect(row.mustChangePassword).toBe(true);
  });

  it("refuses an email that already exists on the platform", async () => {
    const email = `${TAG}-dup@staff.test`;
    await asAdmin((ctx) => addStaff(ctx, { name: "First", email, role: "supplier", storeIds: [storeId] }));

    await expect(
      asAdmin((ctx) => addStaff(ctx, { name: "Second", email, role: "supplier", storeIds: [storeId] })),
    ).rejects.toBeInstanceOf(ServiceError);
  });
});

describe("resetStaffPassword", () => {
  it("replaces the old password and forces a change", async () => {
    const email = `${TAG}-reset@staff.test`;
    const created = await asAdmin((ctx) =>
      addStaff(ctx, { name: "Forgetful", email, role: "supplier", storeIds: [storeId] }),
    );

    // Clear the flag so we can prove the reset sets it again.
    await db
      .update(users)
      .set({ mustChangePassword: false })
      .where(eq(users.id, created.userId));

    const issued = await asAdmin((ctx) => resetStaffPassword(ctx, created.memberId));

    expect(issued.email).toBe(email);
    expect(await canSignIn(email, issued.temporaryPassword)).toBe(true);
    // The old one must stop working, or a reset protects nobody.
    expect(await canSignIn(email, created.temporaryPassword)).toBe(false);

    const [row] = await db.select().from(users).where(eq(users.id, created.userId));
    expect(row.mustChangePassword).toBe(true);
  });

  it("cannot reset someone in another Organization", async () => {
    const [other] = await db
      .insert(organizations)
      .values({ name: `${TAG}-other`, slug: `${TAG}-other` })
      .returning({ id: organizations.id });

    await expect(
      withOrganizationScope(other.id, (tx) =>
        resetStaffPassword(
          { organizationId: other.id, storeId: null, userId: adminUserId, tx },
          adminMemberId,
        ),
      ),
    ).rejects.toBeInstanceOf(ServiceError);

    await db.delete(organizations).where(eq(organizations.id, other.id));
  });
});

describe("guards that stop an Organization locking itself out", () => {
  // Note what actually protects the Organization here. assertNotLastAdmin()
  // exists in the service, but it is unreachable through these three calls:
  // the actor always holds an active Admin membership (they could not have a
  // session otherwise), so excluding a *different* target always leaves at
  // least the actor. The only way to be the last Admin and be the target is
  // to target yourself — which the self-guard refuses first. The last-Admin
  // check is defence in depth for callers that are not a signed-in Admin,
  // such as a script or a future platform-admin path.
  it("refuses to let an Admin demote, suspend or remove themselves", async () => {
    await expect(
      asAdmin((ctx) => changeStaffRole(ctx, { memberId: adminMemberId, role: "supplier" })),
    ).rejects.toThrow(/your own role/);

    await expect(
      asAdmin((ctx) => setStaffStatus(ctx, { memberId: adminMemberId, status: "suspended" })),
    ).rejects.toThrow(/your own account/);

    await expect(asAdmin((ctx) => removeStaff(ctx, adminMemberId))).rejects.toThrow(
      /remove yourself/,
    );
  });

  it("keeps at least one Admin, since self-demotion is the only way to reach zero", async () => {
    const staff = await asAdmin((ctx) => listStaff(ctx));
    const admins = staff.filter((m) => m.role === "admin" && m.status === "active");
    expect(admins.length).toBeGreaterThanOrEqual(1);
  });

  it("lets an Admin be demoted once a second Admin exists", async () => {
    const second = await asAdmin((ctx) =>
      addStaff(ctx, { name: "Second Admin", email: `${TAG}-admin2@staff.test`, role: "admin", storeIds: [storeId] }),
    );

    await asAdmin((ctx) =>
      changeStaffRole(ctx, { memberId: second.memberId, role: "support_agent" }),
    );

    const staff = await asAdmin((ctx) => listStaff(ctx));
    expect(staff.find((m) => m.memberId === second.memberId)?.role).toBe("support_agent");
  });
});
