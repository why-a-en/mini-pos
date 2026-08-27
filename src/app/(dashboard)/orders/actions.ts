"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { withCurrentOrganization } from "@/lib/tenancy";
import { orders, orderItems, orderItemModifiers, customers } from "@/db/schema";

// Unfinished orders pile up silently if there's no ceiling — a support
// agent who starts a new one every time a chat gets complicated and rarely
// circles back would otherwise accumulate an unbounded backlog, most of it
// probably abandoned rather than genuinely paused. Per user (createdBy),
// not per org: this is about one agent's own follow-up queue staying
// workable, not a shared org-wide cap.
const MAX_OPEN_DRAFTS_PER_USER = 5;

/**
 * Creates a Customer inline, mid-wizard (docs/PRD.md §7.1 step 2: "search
 * for the Customer, or creates them, if new") — same required fields
 * (name, phone, address) `createOrderAction` used to enforce before it was
 * split into this + `createOrderWithItemsAction` for the multi-step order
 * wizard (see new-order-wizard.tsx). Returns the new row so the wizard can
 * select it and move to the Items step without a page round-trip.
 */
export async function createCustomerAction(input: { name: string; phone: string; address: string }) {
  const name = input.name.trim();
  const phone = input.phone.trim();
  const address = input.address.trim();

  if (!name) throw new Error("Name is required.");
  if (!phone) throw new Error("Phone number is required.");
  if (!address) throw new Error("Address is required.");

  const customer = await withCurrentOrganization(async ({ organizationId, tx }) => {
    const [row] = await tx
      .insert(customers)
      .values({ organizationId, name, phone, address })
      .returning({ id: customers.id, name: customers.name, phone: customers.phone });
    return row;
  });

  revalidatePath("/customers");
  return customer;
}

/**
 * Creates an Order (or adds to one already started — `input.orderId`, when
 * resuming a saved draft) and inserts any new Order Items + their modifier
 * selections in one transaction. The wizard holds the in-progress cart in
 * client state and only commits here — either as a draft (`place: false`,
 * `orders.placed_at` stays null, the wizard's sheet just closes and the
 * order sits in the list to resume later) or placed (`place: true`,
 * `placed_at` is set, redirects to the order detail page, and every new
 * pending Order Item shows up in the Purchase Queue immediately per
 * docs/PRD.md §7.1 step 5). An abandoned *fresh* wizard (never saved at
 * all) still leaves nothing behind — this only runs on an explicit Save.
 */
export async function saveOrderAction(input: {
  orderId?: string;
  customerId: string;
  notes?: string;
  items: { productId: string; modifierOptionIds: string[]; quantity: number }[];
  place: boolean;
}): Promise<{ orderId: string }> {
  if (!input.customerId) throw new Error("Missing customer.");

  const orderId = await withCurrentOrganization(async ({ organizationId, userId, tx }) => {
    let id = input.orderId;
    const notes = input.notes?.trim() || null;

    if (id) {
      await tx
        .update(orders)
        .set({ notes, ...(input.place ? { placedAt: new Date() } : {}) })
        .where(and(eq(orders.id, id), eq(orders.organizationId, organizationId)));
    } else {
      // Only a brand-new order saved *as a draft* counts against the cap —
      // placing a new order outright never creates a draft in the first
      // place, and updating an already-counted existing draft (the `if (id)`
      // branch above) isn't starting a new one.
      if (!input.place) {
        const openDrafts = await tx
          .select({ id: orders.id })
          .from(orders)
          .where(and(eq(orders.organizationId, organizationId), eq(orders.createdBy, userId), isNull(orders.placedAt)));
        if (openDrafts.length >= MAX_OPEN_DRAFTS_PER_USER) {
          throw new Error(`You already have ${MAX_OPEN_DRAFTS_PER_USER} draft orders — finish or place one before starting another.`);
        }
      }

      const [order] = await tx
        .insert(orders)
        .values({ organizationId, customerId: input.customerId, notes, createdBy: userId, placedAt: input.place ? new Date() : null })
        .returning({ id: orders.id });
      id = order.id;
    }

    if (input.items.length > 0) {
      const insertedItems = await tx
        .insert(orderItems)
        .values(input.items.map((item) => ({ organizationId, orderId: id!, productId: item.productId, quantity: item.quantity })))
        .returning({ id: orderItems.id });

      const modifierRows = input.items.flatMap((item, i) =>
        item.modifierOptionIds.map((modifierOptionId) => ({ organizationId, orderItemId: insertedItems[i].id, modifierOptionId })),
      );
      if (modifierRows.length > 0) {
        await tx.insert(orderItemModifiers).values(modifierRows);
      }
    }

    return id!;
  });

  revalidatePath("/orders");
  if (input.place) {
    revalidatePath("/purchase-queue");
    revalidatePath("/parcels");
    redirect(`/orders/${orderId}`);
  }
  return { orderId };
}

/**
 * An Order is closed to new Items once it is placed. Items are added only
 * while the order is still being built in the wizard (saveOrderAction
 * above, which inserts the whole cart in one transaction) — there is no
 * "add another item to an existing order" path, and the /orders/[id]/add-item
 * screen that used to offer one is gone. An extra product a Customer asks
 * for after the fact is a new Order, which keeps each Order a faithful
 * record of one request rather than something that quietly grows after
 * Purchasing has already acted on it.
 */

export async function cancelOrderItemAction(formData: FormData) {
  const orderItemId = String(formData.get("orderItemId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;

  await withCurrentOrganization(async ({ organizationId, tx }) => {
    await tx
      .update(orderItems)
      .set({ status: "cancelled", cancellationReason: reason, cancelledAt: new Date() })
      .where(and(eq(orderItems.id, orderItemId), eq(orderItems.organizationId, organizationId)));
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/purchase-queue");
  revalidatePath("/parcels");
}
