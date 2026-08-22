// PROTOTYPE — Variant A: "Grouped by product"
//
// Leads with the product, not the order: PRD §6.3's literal ask ("Product
// X — 3 orders, qty 5 total") as the primary information hierarchy. Good
// when duplicate orders for the same item are the common case the Supplier
// needs surfaced without scrolling/counting by eye.
import { groupByProduct, formatModifiers, relativeAge, type PendingOrderRow } from "./pending-orders-types";
import { BatchActionButton } from "./prototype-batch-action-button";
import { markPurchasedAction, cancelOrderAction } from "./actions";

export function PendingOrdersVariantA({ rows }: { rows: PendingOrderRow[] }) {
  const groups = groupByProduct(rows);

  return (
    <ul className="space-y-4">
      {groups.map((group) => (
        <li key={group.productId} className="rounded-xl border border-neutral-200">
          <div className="flex items-start justify-between gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{group.productName}</p>
              <p className="text-sm text-neutral-500">
                {group.orders.length} order{group.orders.length === 1 ? "" : "s"} · qty{" "}
                {group.totalQuantity} total
              </p>
              {group.sourceUrl && (
                <a
                  href={group.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-blue-600 underline"
                >
                  Open listing
                </a>
              )}
            </div>
            {group.orders.length > 1 && (
              <BatchActionButton
                orderIds={group.orders.map((o) => o.id)}
                action={markPurchasedAction}
                label={`Mark all ${group.orders.length} purchased`}
                pendingLabel="Marking…"
                className="min-h-11 shrink-0 whitespace-nowrap rounded-md bg-green-600 px-3 text-sm font-medium text-white disabled:opacity-60"
              />
            )}
          </div>
          <ul className="divide-y divide-neutral-100">
            {group.orders.map((order) => {
              const modifiers = formatModifiers(order.selectedModifiers);
              return (
                <li key={order.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {order.customerName}
                      <span className="ml-2 text-neutral-400">qty {order.quantity}</span>
                    </p>
                    {modifiers && <p className="text-sm text-neutral-500">{modifiers}</p>}
                    {order.notes && <p className="text-sm text-neutral-500 italic">{order.notes}</p>}
                    <p className="text-xs text-neutral-400">{relativeAge(order.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <form action={markPurchasedAction.bind(null, order.id)}>
                      <button
                        type="submit"
                        className="min-h-9 w-full rounded-md bg-green-600 px-3 text-xs font-medium text-white"
                      >
                        Purchased
                      </button>
                    </form>
                    <form action={cancelOrderAction.bind(null, order.id)}>
                      <button
                        type="submit"
                        className="min-h-9 w-full rounded-md border border-neutral-300 px-3 text-xs font-medium"
                      >
                        Cancel
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}
