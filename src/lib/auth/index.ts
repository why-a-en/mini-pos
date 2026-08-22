import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "./hash";
import { createSession, getSessionUser, invalidateSession } from "./session";

export { getSessionUser } from "./session";

export type LoginResult = { ok: true } | { ok: false; error: string };

/**
 * Looks up by email only (not vendor-scoped) — email is globally unique
 * (docs/DATA_MODEL.md `users.email` UNIQUE) and we don't know the vendor
 * until after this succeeds.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  // Same generic error whether the email doesn't exist or the password is
  // wrong — don't leak which one it was.
  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    return { ok: false, error: "Invalid email or password." };
  }

  await createSession(user.id);
  return { ok: true };
}

export async function logout(): Promise<void> {
  await invalidateSession();
}

export { hashPassword };

/** For Server Components/layouts that just want to know who's signed in. */
export async function getCurrentUser() {
  return getSessionUser();
}

/** For Server Components/layouts that must be behind a session. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
