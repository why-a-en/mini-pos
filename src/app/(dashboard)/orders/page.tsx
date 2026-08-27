import { and, desc, eq, gte, lte, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { withCurrentOrganization } from "@/lib/tenancy";
import { orders, orderItems, orderItemModifiers, customers, products, modifierOptions } from "@/db/schema";
import { resolveDateWindow } from "@/lib/date-range";
import { OrdersView, type OrderRowData } from "./orders-view";

/** Formatted here on the server rather than in the client component, so the
 *  two can't disagree: `toLocaleDateString` reads the runtime's locale and
 *  timezone, and letting the browser format an ISO string that the server
 *  already rendered is a textbook hydration mismatch. Same server-local-time
 *  caveat as home/page.tsx's "today" — there's no per-org timezone column
 *  on the schema yet.
 *
 *  This year's orders drop the year (a queue is mostly recent), older ones
 *  keep it so an archived order can't be misread as current. */
function formatOrderDate(date: Date): string {
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

// The full Order log (docs/PRD.md §6.2) — filterable by customer, separate
// from the Supplier's Purchase Queue and Parcels, which each
// look at order_items directly rather than orders. Search moved
// client-side over the fetched page (matches the Purchase Queue reskin) —
// the existing 50-row cap already bounds this to a size that doesn't need a
// server round-trip per keystroke.
//
// The Customer→Items wizard lives at its own route now (see orders/new/
// page.tsx) rather than being fed from here — this page only needs enough
// per-order data to render the list (including each draft's own summary).
export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const user = await requireUser();
  const canCreate = user.role !== "supplier";

  // Date is a SERVER filter, unlike the search/status filters beside it: the
  // 50-row cap below is applied *after* the where clause, so narrowing the
  // window client-side would only ever look inside the newest 50 orders.
  const dateWindow = resolveDateWindow(await searchParams);

  const data = await withCurrentOrganization(async ({ organizationId, tx }) => {
    const orderRows = await tx
      .select({
        id: orders.id,
        customerId: orders.customerId,
        customerName: customers.name,
        customerPhone: customers.phone,
        customerAddress: customers.address,
        notes: orders.notes,
        createdAt: orders.createdAt,
        placedAt: orders.placedAt,
      })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(
        and(
          eq(orders.organizationId, organizationId),
          ...(dateWindow.from ? [gte(orders.createdAt, dateWindow.from)] : []),
          ...(dateWindow.to ? [lte(orders.createdAt, dateWindow.to)] : []),
        ),
      )
      .orderBy(desc(orders.createdAt))
      .limit(50);

    const orderIds = orderRows.map((o) => o.id);
    const itemRows =
      orderIds.length === 0
        ? []
        : await tx
            .select({
              id: orderItems.id,
              orderId: orderItems.orderId,
              status: orderItems.status,
              quantity: orderItems.quantity,
              productName: products.name,
              productPrice: products.price,
            })
            .from(orderItems)
            .innerJoin(products, eq(products.id, orderItems.productId))
            .where(inArray(orderItems.orderId, orderIds));

    const itemIds = itemRows.map((r) => r.id);
    const selectionRows =
      itemIds.length === 0
        ? []
        : await tx
            .select({ orderItemId: orderItemModifiers.orderItemId, value: modifierOptions.value })
            .from(orderItemModifiers)
            .innerJoin(modifierOptions, eq(modifierOptions.id, orderItemModifiers.modifierOptionId))
            .where(inArray(orderItemModifiers.orderItemId, itemIds));
    const selectionsByItem = new Map<string, string[]>();
    for (const s of selectionRows) {
      const list = selectionsByItem.get(s.orderItemId) ?? [];
      list.push(s.value);
      selectionsByItem.set(s.orderItemId, list);
    }

    const statusesByOrder = new Map<string, string[]>();
    const itemsByOrder = new Map<string, { productName: string; price: string | null; selection: string[]; quantity: number }[]>();
    for (const row of itemRows) {
      const statuses = statusesByOrder.get(row.orderId) ?? [];
      statuses.push(row.status);
      statusesByOrder.set(row.orderId, statuses);

      const items = itemsByOrder.get(row.orderId) ?? [];
      items.push({ productName: row.productName, price: row.productPrice, selection: selectionsByItem.get(row.id) ?? [], quantity: row.quantity });
      itemsByOrder.set(row.orderId, items);
    }

    return orderRows.map(
      (order): OrderRowData => ({
        id: order.id,
        customerName: order.customerName,
        createdAtLabel: formatOrderDate(order.createdAt),
        itemStatuses: statusesByOrder.get(order.id) ?? [],
        draft: order.placedAt
          ? null
          : {
              orderId: order.id,
              customer: { id: order.customerId, name: order.customerName, phone: order.customerPhone, address: order.customerAddress },
              notes: order.notes ?? "",
              existingItems: itemsByOrder.get(order.id) ?? [],
            },
      }),
    );
  });

  return <OrdersView orders={data} canCreate={canCreate} window={dateWindow} />;
}
