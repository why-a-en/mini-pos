"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  listMemberships,
  logout,
  requireUser,
  setActiveOrganization,
  setActiveStore,
  startImpersonation,
  stopImpersonation,
} from "@/lib/auth";

export async function logoutAction() {
  await logout();
  redirect("/login");
}

/**
 * Re-stamps the session's active Organization (ADR-0002 decision 4).
 *
 * The membership check is defence-in-depth: better-auth validates this too,
 * but this is the one action in the app whose whole job is to change which
 * tenant's data the caller can see, so it does not take the caller's word for
 * it. Every page is re-rendered afterwards — cached output belongs to the
 * Organization it was rendered for.
 */
export async function switchOrganizationAction(organizationId: string) {
  const user = await requireUser();

  const memberships = await listMemberships(user.id);
  const target = memberships.find((m) => m.organizationId === organizationId);
  if (!target) throw new Error("You are not a member of that Organization.");
  if (target.status !== "active") throw new Error("That Organization is suspended.");

  await setActiveOrganization(organizationId);

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Re-stamps the session's active Store (see setActiveStore's own comment).
 * The grant check lives inside setActiveStore(); like the Organization
 * switch above, every page is re-rendered afterwards because cached output
 * belongs to the Store it was rendered for.
 */
export async function switchStoreAction(storeId: string) {
  await setActiveStore(storeId);
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Begins acting as another user for support. Guarded inside
 * startImpersonation() — the allowlist check is not the caller's to make.
 */
export type ImpersonationActionState = { error?: string } | undefined;

export async function startImpersonationAction(
  _prev: ImpersonationActionState,
  formData: FormData,
): Promise<ImpersonationActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter an email address." };

  try {
    await startImpersonation(email);
  } catch (error) {
    // Shown inline, the way the login form shows a bad password. Throwing
    // here would surface Next's full-page runtime error instead, which is
    // both alarming and gives the admin no way back to the form.
    return { error: error instanceof Error ? error.message : "Could not impersonate." };
  }

  revalidatePath("/", "layout");
  // Deliberately outside the try: redirect() signals by throwing, and
  // catching that would turn a successful impersonation into an error.
  redirect("/");
}

/** Returns the admin to their own session and closes the audit row. */
export async function stopImpersonationAction() {
  await stopImpersonation();

  revalidatePath("/", "layout");
  redirect("/settings");
}
