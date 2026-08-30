import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { impersonationEvents, members, organizations, users } from "@/db/schema";
import { auth } from "./config";

// The boundary between better-auth and the rest of the app. Feature code
// imports from here — never from ./config — so swapping the auth library
// stays a change to this file plus tenancy.ts. See ADR-0002 and
// docs/ARCHITECTURE_ROADMAP.md §1.

/**
 * The functional role, within an Organization. Stored on `members.role` as
 * text (better-auth writes comma-separated values for multi-role members,
 * which a pg enum can't hold) — this union is what keeps it honest in
 * TypeScript.
 *
 * **Two different things are called "admin" in this codebase, and they are
 * not related:**
 *
 * - `AppRole = "admin"` (here) — a *tenant* role. The reseller's own
 *   administrator: manages their staff, sees their reports. Scoped to one
 *   Organization like any other member, and holds no power outside it.
 * - `users.role` / `PLATFORM_ADMIN_USER_IDS` — *platform* administration.
 *   That's us, the operator, and it's what gates impersonation.
 *
 * A tenant admin can never become a platform admin; the latter is an
 * environment allowlist with no in-app path to it.
 */
export type AppRole = "admin" | "support_agent" | "supplier";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  /** The *active* Organization, from the session — not a property of the user. */
  organizationId: string;
  role: AppRole;
  /** Set while a platform admin is acting as this user. */
  impersonatedBy: string | null;
};

/**
 * Resolves the request to the signed-in user and their active Organization,
 * or null.
 *
 * The membership is read on each call rather than baked into the session, so
 * a role change or a suspension takes effect on the next request instead of
 * waiting for the session cookie cache to expire (ADR-0002 decision 3). The
 * cookie cache still spares us the session and user lookups; what remains is
 * one indexed query on `members`.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const organizationId = session.session.activeOrganizationId;
  // No active Organization means the session predates a membership, or the
  // membership was revoked. Either way there is nothing to scope to.
  if (!organizationId) return null;

  const [row] = await db
    .select({ role: members.role, status: organizations.status })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .where(
      and(eq(members.userId, session.user.id), eq(members.organizationId, organizationId)),
    )
    .limit(1);

  if (!row) return null;
  // Suspension: the only lever over a client account (ADR-0002 decision 8).
  if (row.status !== "active") return null;

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    organizationId,
    role: row.role as AppRole,
    impersonatedBy: session.session.impersonatedBy ?? null,
  };
}

/** For Server Components/layouts that must be behind a session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export type LoginResult = { ok: true } | { ok: false; error: string };

/**
 * Signature unchanged from the self-rolled implementation this replaced, so
 * the login form and its action didn't have to move. Passwords still verify
 * through argon2 (config.ts wires hash.ts into better-auth), which is why
 * migrating users were never asked to reset.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });
    return { ok: true };
  } catch {
    // Same generic error whether the email doesn't exist or the password is
    // wrong — don't leak which one it was.
    return { ok: false, error: "Invalid email or password." };
  }
}

export async function logout(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
}

/** Every Organization the signed-in user belongs to — backs the switcher. */
export async function listMemberships(userId: string) {
  return db
    .select({
      organizationId: members.organizationId,
      name: organizations.name,
      role: members.role,
      status: organizations.status,
    })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .where(eq(members.userId, userId));
}

/** Re-stamps the session's active Organization. ADR-0002 decision 4. */
export async function setActiveOrganization(organizationId: string): Promise<void> {
  await auth.api.setActiveOrganization({
    body: { organizationId },
    headers: await headers(),
  });
}

// --- Support impersonation ------------------------------------------------
//
// Platform admins can act as a tenant's user to debug their data. Two things
// are added on top of what the admin plugin gives us, both required by
// ADR-0002: an append-only audit row that outlives the impersonated session,
// and a banner (see ImpersonationBanner) so nobody mistakes a client's
// account for their own.

/** Allowlist, not a database column — there is no in-app path to becoming one. */
export function isPlatformAdmin(userId: string): boolean {
  return (process.env.PLATFORM_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(userId);
}

/**
 * Starts acting as `email`'s user. Writes the audit row *after* the session
 * swap succeeds, so a failed impersonation doesn't leave a phantom record.
 */
export async function startImpersonation(email: string): Promise<void> {
  const actor = await requireUser();
  if (!isPlatformAdmin(actor.id)) throw new Error("Not permitted.");

  const [target] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!target) throw new Error(`No user with email ${email}.`);
  if (target.id === actor.id) throw new Error("You are already yourself.");

  await auth.api.impersonateUser({
    body: { userId: target.id },
    headers: await headers(),
  });

  const [membership] = await db
    .select({ organizationId: members.organizationId })
    .from(members)
    .where(eq(members.userId, target.id))
    .orderBy(members.createdAt)
    .limit(1);

  await db.insert(impersonationEvents).values({
    adminUserId: actor.id,
    targetUserId: target.id,
    organizationId: membership?.organizationId ?? null,
  });
}

/**
 * Returns the admin to their own session and closes the audit row.
 *
 * The row is closed before the session swap, because afterwards there is no
 * longer anything on the request identifying who was impersonating whom —
 * `sessions.impersonated_by` disappears with the session.
 */
export async function stopImpersonation(): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  const adminUserId = session?.session.impersonatedBy;

  if (session && adminUserId) {
    const [open] = await db
      .select({ id: impersonationEvents.id })
      .from(impersonationEvents)
      .where(
        and(
          eq(impersonationEvents.adminUserId, adminUserId),
          eq(impersonationEvents.targetUserId, session.user.id),
          isNull(impersonationEvents.endedAt),
        ),
      )
      .orderBy(desc(impersonationEvents.startedAt))
      .limit(1);

    if (open) {
      await db
        .update(impersonationEvents)
        .set({ endedAt: new Date() })
        .where(eq(impersonationEvents.id, open.id));
    }
  }

  await auth.api.stopImpersonating({ headers: await headers() });
}

// Display labels. A Record keyed on AppRole, not a ternary: adding a role
// makes this a compile error until the map is extended, rather than silently
// falling through to the wrong label.
const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  support_agent: "Support Agent",
  supplier: "Supplier",
};

export function roleLabel(role: AppRole): string {
  return ROLE_LABELS[role];
}
