"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import { createOrganization, setOrganizationStatus } from "@/services/platform";
import { ServiceError } from "@/services/types";

// Thin wrappers — rules live in src/services/platform.ts. requirePlatformAdmin()
// on every action, not just the page: hiding a link is not access control.

export type PlatformActionResult = { error?: string };

/** The new Admin's one-time password, returned once so we can pass it on. */
export type NewOrgResult = PlatformActionResult & {
  slug?: string;
  adminEmail?: string;
  temporaryPassword?: string;
};

export async function createOrganizationAction(
  _prev: NewOrgResult | undefined,
  formData: FormData,
): Promise<NewOrgResult> {
  await requirePlatformAdmin();
  try {
    const result = await createOrganization({
      organizationName: String(formData.get("organizationName") ?? ""),
      adminName: String(formData.get("adminName") ?? ""),
      adminEmail: String(formData.get("adminEmail") ?? ""),
    });
    revalidatePath("/platform");
    return {
      slug: result.slug,
      adminEmail: result.adminEmail,
      temporaryPassword: result.temporaryPassword,
    };
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message };
    throw error;
  }
}

export async function setOrganizationStatusAction(
  organizationId: string,
  status: "active" | "suspended",
): Promise<PlatformActionResult> {
  await requirePlatformAdmin();
  try {
    await setOrganizationStatus({ organizationId, status });
    revalidatePath("/platform");
    revalidatePath("/", "layout");
    return {};
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message };
    throw error;
  }
}
