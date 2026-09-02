import { count, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, members, organizations, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/hash";
import { generateTemporaryPassword } from "./password";
import { ServiceError } from "./types";

// The platform console — provisioning and suspending client Organizations.
// This is *us*, the operator, not a tenant Admin, so unlike every other
// service here it doesn't take a `ServiceContext`: there is no Organization
// to scope to (it creates one), and every table it touches — organizations,
// users, accounts, members — is RLS-exempt (see DATA_MODEL §5). It imports
// `db` directly for the same reason `withOrganizationScope` lives in
// db/client rather than in a service.
//
// The one table it does NOT touch is `stores`: a new Organization is
// deliberately created without one, so its Admin is walked through creating
// the first Store (and their team) at /onboarding on first login — that
// flow exists for exactly this. See ADR-0004 decision 6.

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  memberCount: number;
  createdAt: Date;
};

export async function listOrganizations(): Promise<OrganizationSummary[]> {
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      status: organizations.status,
      createdAt: organizations.createdAt,
      memberCount: count(members.id),
    })
    .from(organizations)
    .leftJoin(members, eq(members.organizationId, organizations.id))
    .groupBy(organizations.id)
    .orderBy(desc(organizations.createdAt));

  return rows;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type NewOrganization = {
  organizationId: string;
  slug: string;
  adminEmail: string;
  temporaryPassword: string;
};

/**
 * Creates a client Organization and its first Admin, in one transaction —
 * the in-app equivalent of `pnpm org:create`.
 *
 * The Admin account is written by hand (not `auth.api.signUpEmail`), same as
 * addStaff and for the same reason: signUpEmail issues a session, which
 * inside a Server Action would swap *our* login for the new Admin's. The
 * account shape has to match sign-in exactly — issuer `local:credential`,
 * providerId `credential`, accountId = user id.
 */
export async function createOrganization(input: {
  organizationName: string;
  adminName: string;
  adminEmail: string;
}): Promise<NewOrganization> {
  const name = input.organizationName.trim();
  const adminName = input.adminName.trim();
  const adminEmail = input.adminEmail.trim().toLowerCase();

  if (!name) throw new ServiceError("Organization name is required.");
  if (!adminName) throw new ServiceError("The Admin's name is required.");
  if (!adminEmail.includes("@")) throw new ServiceError("Enter a valid Admin email.");

  const slug = slugify(name);
  if (!slug) throw new ServiceError("That name has no letters or digits to slugify.");

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  return db.transaction(async (tx) => {
    const [slugTaken] = await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    if (slugTaken) {
      throw new ServiceError(`An Organization named something like "${name}" already exists.`);
    }

    const [emailTaken] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);
    if (emailTaken) {
      throw new ServiceError("That email already has an account on the platform.");
    }

    const [org] = await tx
      .insert(organizations)
      .values({ name, slug })
      .returning({ id: organizations.id, slug: organizations.slug });

    const [user] = await tx
      .insert(users)
      .values({ name: adminName, email: adminEmail, mustChangePassword: true })
      .returning({ id: users.id });

    await tx.insert(accounts).values({
      issuer: "local:credential",
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: passwordHash,
    });

    await tx.insert(members).values({ organizationId: org.id, userId: user.id, role: "admin" });

    return {
      organizationId: org.id,
      slug: org.slug,
      adminEmail,
      temporaryPassword,
    };
  });
}

export async function setOrganizationStatus(input: {
  organizationId: string;
  status: "active" | "suspended";
}): Promise<void> {
  await db
    .update(organizations)
    .set({ status: input.status })
    .where(eq(organizations.id, input.organizationId));
}
