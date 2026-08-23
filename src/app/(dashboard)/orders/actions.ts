"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { withCurrentOrganization } from "@/lib/tenancy";
import { orders, orderItems, orderItemModifiers, customers } from "@/db/schema";

/**
 * Creates the Order header. The Customer is search-or-create (docs/PRD.md
 * §5.3): if `newCustomerName` is filled in, that takes precedence over
 * `existingCustomerId` — a new Customer is created inline, matching the
 * same "create it without leaving the flow" pattern as Modifiers on
 * Products.
 */
export async function createOrderAction(formData: FormData) {
  const existingCustomerId = String(formData.get("existingCustomerId") ?? "").trim() || null;
  const newCustomerName = String(formData.get("newCustomerName") ?? "").trim();
  const newCustomerPhone = String(formData.get("newCustomerPhone") ?? "").trim();
  const newCustomerAddress = String(formData.get("newCustomerAddress") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!existingCustomerId && !newCustomerName) {
    throw new Error("Pick an existing customer or enter a name for a new one.");
  }
  if (newCustomerName && !newCustomerPhone) {
    throw new Error("Phone number is required for a new customer.");
  }
  if (newCustomerName && !newCustomerAddress) {
    throw new Error("Address is required for a new customer.");
  }

  const orderId = await withCurrentOrganization(async ({ organizationId, userId, tx }) => {
    let customerId = existingCustomerId;
    if (newCustomerName) {
      const [customer] = await tx
        .insert(customers)
        .values({
          organizationId,
          name: newCustomerName,
          phone: newCustomerPhone,
          address: newCustomerAddress,
        })
        .returning({ id: customers.id });
      customerId = customer.id;
    }

    const [order] = await tx
      .insert(orders)
      .values({ organizationId, customerId: customerId!, notes, createdBy: userId })
      .returning({ id: orders.id });
    return order.id;
  });

  revalidatePath("/orders");
  redirect(`/orders/${orderId}`);
}

/**
 * Adds one Order Item (product + modifier selection + quantity).
 *
 * Each modifier group on the add-item form is a radio group named
 * `modifierOptionId__<modifierId>` — a distinct name per group so they
 * don't compete as one mutually-exclusive set — so the selections are
 * pulled out by prefix rather than a single repeated field name.
 */
export async function addOrderItemAction(formData: FormData) {
  const orderId = String(formData.get("orderId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const quantity = Number(formData.get("quantity") ?? 1) || 1;
  const modifierOptionIds = Array.from(formData.entries())
    .filter(([key]) => key.startsWith("modifierOptionId__"))
    .map(([, value]) => String(value))
    .filter(Boolean);

  if (!orderId || !productId) throw new Error("Missing order or product.");

  await withCurrentOrganization(async ({ organizationId, tx }) => {
    const [item] = await tx
      .insert(orderItems)
      .values({ organizationId, orderId, productId, quantity })
      .returning({ id: orderItems.id });

    if (modifierOptionIds.length > 0) {
      await tx.insert(orderItemModifiers).values(
        modifierOptionIds.map((modifierOptionId) => ({
          organizationId,
          orderItemId: item.id,
          modifierOptionId,
        })),
      );
    }
  });

  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}

export async function cancelOrderItemAction(formData: FormData) {
  const orderItemId = String(formData.get("orderItemId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;

  await withCurrentOrganization(async ({ organizationId, tx }) => {
    await tx
      .update(orderItems)
      .set({ status: "cancelled", cancellationReason: reason })
      .where(and(eq(orderItems.id, orderItemId), eq(orderItems.organizationId, organizationId)));
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/purchase-queue");
  revalidatePath("/packing-queue");
}
