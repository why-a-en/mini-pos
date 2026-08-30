"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { changeOwnPassword } from "@/lib/auth";

export type ChangePasswordState = { error?: string } | undefined;

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword) return { error: "Enter your current password." };
  if (newPassword.length < 8) return { error: "New password must be at least 8 characters." };
  if (newPassword !== confirmPassword) return { error: "The two new passwords don't match." };
  if (newPassword === currentPassword) {
    // The whole point of the forced change is that someone else knows the
    // current one, so keeping it is not a change.
    return { error: "Choose a password different from your current one." };
  }

  const result = await changeOwnPassword(currentPassword, newPassword);
  if (!result.ok) return { error: result.error };

  revalidatePath("/", "layout");
  // Outside any try/catch — redirect signals by throwing.
  redirect("/");
}
