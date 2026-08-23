"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { withCurrentOrganization } from "@/lib/tenancy";
import { orderItems } from "@/db/schema";

/**
 * The core feature (docs/PRD.md §6.3): marks every pending Order Item for
 * `productId` as Purchased in one action, across every order/customer —
 * not one order at a time.
 */
export async function batchMarkPurchasedAction(productId: string) {
  await withCurrentOrganization(async ({ organizationId, tx }) => {
    await tx
      .update(orderItems)
      .set({ status: "purchased", purchasedAt: new Date() })
      .where(
        and(
          eq(orderItems.organizationId, organizationId),
          eq(orderItems.productId, productId),
          eq(orderItems.status, "pending"),
        ),
      );
  });

  revalidatePath("/purchase-queue");
  revalidatePath("/packing-queue");
}
