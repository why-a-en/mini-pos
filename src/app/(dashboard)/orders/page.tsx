import Link from "next/link";
import { and, desc, eq, ilike, inArray } from "drizzle-orm";
import { withCurrentOrganization } from "@/lib/tenancy";
import { orders, orderItems, customers } from "@/db/schema";
import { fieldInputClass } from "@/components/form-field";

// The full Order log (docs/PRD.md §6.2) — filterable by customer, separate
// from the Supplier's Purchase Queue and the Packing Queue, which each
// look at order_items directly rather than orders.
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const data = await withCurrentOrganization(async ({ organizationId, tx }) => {
    const orderRows = await tx
      .select({
        id: orders.id,
        customerName: customers.name,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(
        q
          ? and(eq(orders.organizationId, organizationId), ilike(customers.name, `%${q}%`))
          : eq(orders.organizationId, organizationId),
      )
      .orderBy(desc(orders.createdAt))
      .limit(50);

    const orderIds = orderRows.map((o) => o.id);
    const itemRows =
      orderIds.length === 0
        ? []
        : await tx
            .select({ orderId: orderItems.orderId, status: orderItems.status })
            .from(orderItems)
            .where(inArray(orderItems.orderId, orderIds));

    const statusesByOrder = new Map<string, string[]>();
    for (const row of itemRows) {
      const list = statusesByOrder.get(row.orderId) ?? [];
      list.push(row.status);
      statusesByOrder.set(row.orderId, list);
    }

    return orderRows.map((order) => ({ ...order, itemStatuses: statusesByOrder.get(order.id) ?? [] }));
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Orders</h1>
        <Link
          href="/orders/new"
          className="min-h-11 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
        >
          + New order
        </Link>
      </div>

      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by customer…"
          className={fieldInputClass}
        />
        <button type="submit" className="min-h-11 shrink-0 rounded-md border border-neutral-300 px-3 text-sm">
          Search
        </button>
      </form>

      {data.length === 0 ? (
        <p className="text-sm text-neutral-500">No orders yet.</p>
      ) : (
        <ul className="space-y-2">
          {data.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="block rounded-lg border border-neutral-200 p-4"
              >
                <p className="font-medium">{order.customerName}</p>
                <p className="text-sm text-neutral-500">
                  {order.itemStatuses.length === 0
                    ? "no items yet"
                    : summarizeStatuses(order.itemStatuses)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function summarizeStatuses(statuses: string[]): string {
  const counts = new Map<string, number>();
  for (const status of statuses) counts.set(status, (counts.get(status) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([status, count]) => `${count} ${status}`)
    .join(", ");
}
