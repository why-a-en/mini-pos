"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { logout, requirePlatformUser, startImpersonation } from "@/lib/auth";

export async function operatorLogoutAction() {
  await logout();
  redirect("/login");
}

/**
 * Start acting as `email`'s user — the one-tap version behind the
 * Impersonate button on the users list and an Organization's member list.
 * Guarded inside startImpersonation() (requirePlatformUser + the audit row);
 * the check here matches every other action.
 */
export async function impersonateAction(email: string): Promise<{ error?: string }> {
  await requirePlatformUser();
  try {
    await startImpersonation(email);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not impersonate." };
  }
  revalidatePath("/", "layout");
  // Outside the try — redirect() throws to signal, and the session is now
  // the target tenant user, so `/` lands in the normal app with the banner.
  redirect("/");
}
