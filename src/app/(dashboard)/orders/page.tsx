import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { withCurrentVendor } from "@/lib/tenancy";
import { orders, products } from "@/db/schema";
import { cancelOrderAction, markPurchasedAction } from "./actions";

// The Supplier's core screen (PRD §6.3): every pending order, grouped
// visually by product name so repeat items are easy to spot, with a
// direct link to the marketplace listing when Customer Service captured one.
export default async function OrdersPage() {
  const pendingOrders = await withCurrentVendor(({ vendorId, tx }) =>
    tx
      .select({
        id: orders.id,
        customerName: orders.customerName,
        quantity: orders.quantity,
        productName: products.name,
        sourceUrl: products.sourceUrl,
      })
      .from(orders)
      .innerJoin(products, eq(orders.productId, products.id))
      .where(and(eq(orders.vendorId, vendorId), eq(orders.status, "pending")))
      .orderBy(asc(orders.createdAt)),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Today&apos;s Pending Orders</h1>
        <Link
          href="/orders/new"
          className="min-h-11 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
        >
          + New order
        </Link>
      </div>

      {pendingOrders.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No pending orders. New orders Customer Service logs will show up here.
        </p>
      ) : (
        <ul className="space-y-3">
          {pendingOrders.map((order) => (
            <li key={order.id} className="rounded-lg border border-neutral-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{order.productName}</p>
                  <p className="text-sm text-neutral-500">
                    {order.customerName} · qty {order.quantity}
                  </p>
                  {order.sourceUrl && (
                    <a
                      href={order.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-blue-600 underline"
                    >
                      Open listing
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <form action={markPurchasedAction.bind(null, order.id)}>
                    <button
                      type="submit"
                      className="min-h-11 w-full rounded-md bg-green-600 px-3 text-sm font-medium text-white"
                    >
                      Mark Purchased
                    </button>
                  </form>
                  <form action={cancelOrderAction.bind(null, order.id)}>
                    <button
                      type="submit"
                      className="min-h-11 w-full rounded-md border border-neutral-300 px-3 text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
