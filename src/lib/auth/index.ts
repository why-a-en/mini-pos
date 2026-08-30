import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { members, organizations } from "@/db/schema";
import { auth } from "./config";

// The boundary between better-auth and the rest of the app. Feature code
// imports from here — never from ./config — so swapping the auth library
// stays a change to this file plus tenancy.ts. See ADR-0002 and
// docs/ARCHITECTURE_ROADMAP.md §1.

/**
 * The functional role, within an Organization. Stored on `members.role` as
 * text (better-auth writes comma-separated values for multi-role members,
 * which a pg enum can't hold) — this union is what keeps it honest in
 * TypeScript. Distinct from `users.role`, which is platform administration.
 */
export type AppRole = "customer_service" | "supplier";

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

// Display-only — the stored role stays `customer_service` ("Support Agent"
// reads better in the UI). A Record, not a ternary: adding a third role makes
// this a compile error until the map is extended, rather than silently
// falling through to the wrong label.
const ROLE_LABELS: Record<AppRole, string> = {
  customer_service: "Support Agent",
  supplier: "Supplier",
};

export function roleLabel(role: AppRole): string {
  return ROLE_LABELS[role];
}
