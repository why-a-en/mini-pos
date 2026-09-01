"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { withCurrentOrganization } from "@/lib/tenancy";
import { createStore, setStoreStatus } from "@/services/stores";
import { ServiceError } from "@/services/types";

// Thin wrappers — the rules live in src/services/stores.ts. See
// admin/staff/actions.ts's own comment; this follows the same shape.

export type StoreActionResult = { error?: string };

async function asAdmin<T>(fn: (ctx: Parameters<Parameters<typeof withCurrentOrganization>[0]>[0]) => Promise<T>) {
  await requireAdmin();
  try {
    const value = await withCurrentOrganization(fn);
    revalidatePath("/admin/stores");
    return { value };
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message };
    throw error;
  }
}

export type AddStoreState = StoreActionResult | undefined;

export async function addStoreAction(_prev: AddStoreState, formData: FormData): Promise<AddStoreState> {
  const { error } = await asAdmin((ctx) => createStore(ctx, { name: String(formData.get("name") ?? "") }));
  return error ? { error } : {};
}

export async function setStoreStatusAction(
  storeId: string,
  status: "active" | "suspended",
): Promise<StoreActionResult> {
  const { error } = await asAdmin((ctx) => setStoreStatus(ctx, { storeId, status }));
  return error ? { error } : {};
}
