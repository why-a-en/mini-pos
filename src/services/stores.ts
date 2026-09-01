import { and, asc, count, eq } from "drizzle-orm";
import { memberStores, members, stores } from "@/db/schema";
import { ServiceError, type ServiceContext } from "./types";

// Store management for an Organization's own Admin. No `next/*` imports —
// see ./types.ts and docs/ARCHITECTURE_ROADMAP.md §4.
//
// Unlike src/services/staff.ts, every query here runs inside the caller's
// already-established Organization scope (ctx.tx), because `stores` carries
// the ordinary tenant_isolation RLS policy — it is not exempt the way
// `members`/`member_stores` are. See db/schema.ts's own comment on `stores`.

export type Store = { id: string; name: string; status: "active" | "suspended" };

/** Every Store in the Organization — the Admin's management list. */
export async function listStores(ctx: ServiceContext): Promise<Store[]> {
  return ctx.tx
    .select({ id: stores.id, name: stores.name, status: stores.status })
    .from(stores)
    .where(eq(stores.organizationId, ctx.organizationId))
    .orderBy(asc(stores.createdAt));
}

/**
 * Every Store the calling member can work in — backs the Settings switcher
 * and the onboarding/select-store screens. Joins through `member_stores`
 * (RLS-exempt, hand-filtered here by the caller's own userId+organizationId)
 * to `stores` (RLS-scoped, and already covered by ctx.tx's scope).
 */
export async function listMyStores(ctx: ServiceContext): Promise<Store[]> {
  return ctx.tx
    .select({ id: stores.id, name: stores.name, status: stores.status })
    .from(memberStores)
    .innerJoin(members, eq(members.id, memberStores.memberId))
    .innerJoin(stores, eq(stores.id, memberStores.storeId))
    .where(and(eq(members.userId, ctx.userId), eq(members.organizationId, ctx.organizationId)))
    .orderBy(asc(stores.createdAt));
}

/**
 * Creates a Store.
 *
 * Does NOT grant the creating Admin access to it — an org with 2+ Admins
 * may want only one of them running the new location day to day, so that
 * stays a separate, explicit `member_stores` grant — UNLESS this is the
 * Organization's very first Store. With nobody else granted yet, an Admin
 * who just created their only Store and can't select it is a dead end —
 * exactly the moment onboarding (/onboarding) puts them in. Every Store
 * after the first leaves access to be assigned explicitly, same as any
 * other staff grant.
 */
export async function createStore(ctx: ServiceContext, input: { name: string }): Promise<Store> {
  const name = input.name.trim();
  if (!name) throw new ServiceError("Name is required.");

  const [{ value: existingCount }] = await ctx.tx
    .select({ value: count() })
    .from(stores)
    .where(eq(stores.organizationId, ctx.organizationId));

  const [row] = await ctx.tx
    .insert(stores)
    .values({ organizationId: ctx.organizationId, name })
    .returning({ id: stores.id, name: stores.name, status: stores.status });

  if (existingCount === 0) {
    const [member] = await ctx.tx
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.userId, ctx.userId), eq(members.organizationId, ctx.organizationId)))
      .limit(1);
    if (member) await ctx.tx.insert(memberStores).values({ memberId: member.id, storeId: row.id });
  }

  return row;
}

/** Suspends or restores a Store — the same "keep the row, revoke access to
 *  it" lever `organizations.status`/`members.status` already give at the
 *  levels above. Orders already placed at a suspended Store keep their
 *  history; nothing here touches them. */
export async function setStoreStatus(
  ctx: ServiceContext,
  input: { storeId: string; status: "active" | "suspended" },
): Promise<void> {
  await ctx.tx
    .update(stores)
    .set({ status: input.status })
    .where(and(eq(stores.id, input.storeId), eq(stores.organizationId, ctx.organizationId)));
}

/**
 * Grants an existing member access to a Store. Used by the "Add staff"
 * sheet (services/staff.ts's addStaff) and by a future "edit staff" flow;
 * separated out here rather than duplicated because both need the exact
 * same validation.
 */
export async function grantStoreAccess(
  ctx: ServiceContext,
  input: { memberId: string; storeId: string },
): Promise<void> {
  const [store] = await ctx.tx
    .select({ id: stores.id })
    .from(stores)
    .where(and(eq(stores.id, input.storeId), eq(stores.organizationId, ctx.organizationId)))
    .limit(1);
  if (!store) throw new ServiceError("That Store isn't in this Organization.");

  await ctx.tx
    .insert(memberStores)
    .values({ memberId: input.memberId, storeId: input.storeId })
    .onConflictDoNothing();
}
