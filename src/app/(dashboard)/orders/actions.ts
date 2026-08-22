"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { withCurrentVendor } from "@/lib/tenancy";
import { orders } from "@/db/schema";

export async function createOrderAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerContact = String(formData.get("customerContact") ?? "").trim() || null;
  const quantity = Number(formData.get("quantity") ?? 1) || 1;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!productId || !customerName) {
    throw new Error("Product and customer name are required.");
  }

  await withCurrentVendor(async ({ vendorId, userId, tx }) => {
    await tx.insert(orders).values({
      vendorId,
      productId,
      customerName,
      customerContact,
      quantity,
      notes,
      createdBy: userId,
    });
  });

  revalidatePath("/orders");
}

export async function markPurchasedAction(orderId: string) {
  await withCurrentVendor(async ({ vendorId, tx }) => {
    await tx
      .update(orders)
      .set({ status: "purchased", purchasedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.vendorId, vendorId)));
  });
  revalidatePath("/orders");
}

export async function cancelOrderAction(orderId: string) {
  await withCurrentVendor(async ({ vendorId, tx }) => {
    await tx
      .update(orders)
      .set({ status: "cancelled" })
      .where(and(eq(orders.id, orderId), eq(orders.vendorId, vendorId)));
  });
  revalidatePath("/orders");
}
