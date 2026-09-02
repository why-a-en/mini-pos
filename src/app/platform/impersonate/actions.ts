"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { startImpersonation } from "@/lib/auth";

// Starting impersonation is an operator action. Stopping it lives on the
// tenant side (the ImpersonationBanner) — see (dashboard)/actions.ts.

export type ImpersonateState = { error?: string } | undefined;

export async function startImpersonationAction(
  _prev: ImpersonateState,
  formData: FormData,
): Promise<ImpersonateState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter an email address." };

  try {
    // Guarded inside startImpersonation() — requirePlatformUser() there, plus
    // the audit row. Errors show inline the way the login form's do; throwing
    // would surface Next's full-page error and strand the operator.
    await startImpersonation(email);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not impersonate." };
  }

  revalidatePath("/", "layout");
  // Outside the try — redirect() signals by throwing, and catching that would
  // turn a successful impersonation into an error. The session is now the
  // target tenant user, so `/` lands them in the normal app with the banner.
  redirect("/");
}
