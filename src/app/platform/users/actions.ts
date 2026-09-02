"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePlatformUser, startImpersonation } from "@/lib/auth";

/**
 * The one-tap version of /platform/impersonate — start acting as the user
 * whose row was tapped. Guarded inside startImpersonation()
 * (requirePlatformUser + the audit row); the extra check here matches every
 * other action.
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
