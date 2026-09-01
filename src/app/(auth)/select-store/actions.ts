"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { setActiveStore } from "@/lib/auth";

/**
 * Picks the session's active Store. setActiveStore() checks the target is
 * one of the caller's grants; on success every screen is re-rendered, since
 * cached output belongs to the Store it was rendered for — same reasoning
 * as switchOrganizationAction.
 */
export async function selectStoreAction(storeId: string) {
  await setActiveStore(storeId);
  revalidatePath("/", "layout");
  redirect("/home");
}
