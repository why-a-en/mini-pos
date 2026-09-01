"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { withCurrentOrganization } from "@/lib/tenancy";
import {
  addStaff,
  changeStaffRole,
  removeStaff,
  resetStaffPassword,
  setStaffStatus,
} from "@/services/staff";
import { ServiceError, type AppRole } from "@/services/types";

// Thin wrappers. Every rule lives in src/services/staff.ts; what belongs
// here is exactly what a service cannot do — check the session, and tell
// Next.js to re-render. See docs/ARCHITECTURE_ROADMAP.md §4.

export type StaffActionResult = { error?: string };

/** A temporary password, returned once so the Admin can pass it on. */
export type IssuedPasswordResult = StaffActionResult & {
  email?: string;
  temporaryPassword?: string;
};

type Ctx = Parameters<Parameters<typeof withCurrentOrganization>[0]>[0];

/**
 * requireAdmin() on every action, not just on the page that renders the
 * link. Hiding a shortcut is not access control.
 */
async function asAdmin<T>(
  fn: (ctx: Ctx) => Promise<T>,
): Promise<{ value?: T; error?: string }> {
  await requireAdmin();
  try {
    const value = await withCurrentOrganization(fn);
    revalidatePath("/admin/staff");
    return { value };
  } catch (error) {
    // A rule the Admin broke, shown to them verbatim. Anything else is a
    // bug and should keep its stack rather than be flattened into a string.
    if (error instanceof ServiceError) return { error: error.message };
    throw error;
  }
}

export async function addStaffAction(
  _prev: IssuedPasswordResult | undefined,
  formData: FormData,
): Promise<IssuedPasswordResult> {
  const { value, error } = await asAdmin((ctx) =>
    addStaff(ctx, {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      role: String(formData.get("role") ?? "support_agent") as AppRole,
      storeIds: formData.getAll("storeIds").map(String),
    }),
  );
  if (error) return { error };
  return { email: value!.email, temporaryPassword: value!.temporaryPassword };
}

export async function resetStaffPasswordAction(
  memberId: string,
): Promise<IssuedPasswordResult> {
  const { value, error } = await asAdmin((ctx) => resetStaffPassword(ctx, memberId));
  if (error) return { error };
  return { email: value!.email, temporaryPassword: value!.temporaryPassword };
}

export async function changeStaffRoleAction(
  memberId: string,
  role: AppRole,
): Promise<StaffActionResult> {
  const { error } = await asAdmin((ctx) => changeStaffRole(ctx, { memberId, role }));
  return error ? { error } : {};
}

export async function setStaffStatusAction(
  memberId: string,
  status: "active" | "suspended",
): Promise<StaffActionResult> {
  const { error } = await asAdmin((ctx) => setStaffStatus(ctx, { memberId, status }));
  return error ? { error } : {};
}

export async function removeStaffAction(memberId: string): Promise<StaffActionResult> {
  const { error } = await asAdmin((ctx) => removeStaff(ctx, memberId));
  return error ? { error } : {};
}
