"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { withCurrentOrganization } from "@/lib/tenancy";
import { addStaff, changeStaffRole, removeStaff, setStaffStatus } from "@/services/staff";
import { ServiceError, type AppRole } from "@/services/types";

// Thin wrappers. Every rule lives in src/services/staff.ts; what belongs
// here is exactly what a service cannot do — check the session, and tell
// Next.js to re-render. See docs/ARCHITECTURE_ROADMAP.md §4.

export type StaffActionResult = { error?: string };

/**
 * requireAdmin() on every action, not just on the page that renders the
 * link. Hiding a shortcut is not access control.
 */
async function asAdmin<T>(fn: (ctx: Parameters<Parameters<typeof withCurrentOrganization>[0]>[0]) => Promise<T>): Promise<StaffActionResult> {
  await requireAdmin();
  try {
    await withCurrentOrganization(fn);
  } catch (error) {
    // A rule the Admin broke, shown to them verbatim. Anything else is a
    // bug and should keep its stack rather than be flattened into a string.
    if (error instanceof ServiceError) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/staff");
  return {};
}

export async function addStaffAction(
  _prev: StaffActionResult | undefined,
  formData: FormData,
): Promise<StaffActionResult> {
  const result = await asAdmin((ctx) =>
    addStaff(ctx, {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      role: String(formData.get("role") ?? "support_agent") as AppRole,
    }),
  );
  return result;
}

export async function changeStaffRoleAction(
  memberId: string,
  role: AppRole,
): Promise<StaffActionResult> {
  return asAdmin((ctx) => changeStaffRole(ctx, { memberId, role }));
}

export async function setStaffStatusAction(
  memberId: string,
  status: "active" | "suspended",
): Promise<StaffActionResult> {
  return asAdmin((ctx) => setStaffStatus(ctx, { memberId, status }));
}

export async function removeStaffAction(memberId: string): Promise<StaffActionResult> {
  return asAdmin((ctx) => removeStaff(ctx, memberId));
}
