"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { listMemberships, logout, requireUser, setActiveOrganization } from "@/lib/auth";

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
