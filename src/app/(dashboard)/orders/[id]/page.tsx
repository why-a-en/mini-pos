import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { withCurrentOrganization } from "@/lib/tenancy";
import {
  orders,
  orderItems,
  orderItemModifiers,
  modifierOptions,
  products,
  customers,
} from "@/db/schema";
import { cancelOrderItemAction } from "../actions";

const CANCELLABLE_STATUSES = ["pending", "purchased", "received", "packed"] as const;

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;

  const data = await withCurrentOrganization(async ({ organizationId, tx }) => {
    const [order] = await tx
      .select({
        id: orders.id,
        notes: orders.notes,
        createdAt: orders.createdAt,
        customerName: customers.name,
        customerPhone: customers.phone,
        customerAddress: customers.address,
      })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(and(eq(orders.id, orderId), eq(orders.organizationId, organizationId)))
      .limit(1);
    if (!order) return null;

    const items = await tx
      .select({
        id: orderItems.id,
        productName: products.name,
        quantity: orderItems.quantity,
        status: orderItems.status,
      })
      .from(orderItems)
      .innerJoin(products, eq(products.id, orderItems.productId))
      .where(eq(orderItems.orderId, orderId))
      .orderBy(asc(orderItems.createdAt));

    const itemIds = items.map((item) => item.id);
    const modifierRows =
      itemIds.length === 0
        ? []
        : await tx
            .select({
              orderItemId: orderItemModifiers.orderItemId,
              value: modifierOptions.value,
            })
            .from(orderItemModifiers)
            .innerJoin(modifierOptions, eq(modifierOptions.id, orderItemModifiers.modifierOptionId))
            .where(inArray(orderItemModifiers.orderItemId, itemIds));

    const modifiersByItem = new Map<string, string[]>();
    for (const row of modifierRows) {
      const list = modifiersByItem.get(row.orderItemId) ?? [];
      list.push(row.value);
      modifiersByItem.set(row.orderItemId, list);
    }

    return {
      order,
      items: items.map((item) => ({ ...item, modifiers: modifiersByItem.get(item.id) ?? [] })),
    };
  });

  if (!data) notFound();
  const { order, items } = data;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">{order.customerName}</h1>
        <p className="text-sm text-neutral-500">{order.customerPhone}</p>
        {order.customerAddress && <p className="text-sm text-neutral-500">{order.customerAddress}</p>}
        {order.notes && <p className="text-sm text-neutral-600">{order.notes}</p>}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-700">Items</h2>
          <Link href={`/orders/${order.id}/add-item`} className="text-sm text-blue-600 underline">
            + Add item
          </Link>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-neutral-500">No items yet.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border border-neutral-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-sm text-neutral-500">
                      {item.modifiers.length > 0 ? `${item.modifiers.join(", ")} · ` : ""}
                      qty {item.quantity} · {item.status}
                    </p>
                  </div>
                  {(CANCELLABLE_STATUSES as readonly string[]).includes(item.status) && (
                    <form action={cancelOrderItemAction}>
                      <input type="hidden" name="orderItemId" value={item.id} />
                      <input type="hidden" name="orderId" value={order.id} />
                      <button type="submit" className="text-sm text-red-600 underline">
                        Cancel
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
