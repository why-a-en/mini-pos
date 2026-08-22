// PROTOTYPE — Variant B: "Flat, oldest-first"
//
// The counter-argument to A: no grouping at all, just every pending order
// as one dense row, oldest (most-overdue) first. Bets that a fast, linear
// scan beats a grouped hierarchy once the Supplier already knows their
// catalog by name — and that duplicate products are rare enough not to
// warrant restructuring the list around them. A stat strip up top gives
// the aggregate count without hiding individual orders inside a fold.
import { formatModifiers, relativeAge, type PendingOrderRow } from "./pending-orders-types";
import { markPurchasedAction, cancelOrderAction } from "./actions";

export function PendingOrdersVariantB({ rows }: { rows: PendingOrderRow[] }) {
  const distinctProducts = new Set(rows.map((r) => r.productId)).size;
  const totalQuantity = rows.reduce((sum, r) => sum + r.quantity, 0);
  const oldest = rows[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
        <span>
          <strong className="text-neutral-900">{rows.length}</strong> pending
        </span>
        <span>
          <strong className="text-neutral-900">{distinctProducts}</strong> product
          {distinctProducts === 1 ? "" : "s"}
        </span>
        <span>
          <strong className="text-neutral-900">{totalQuantity}</strong> qty total
        </span>
        {oldest && (
          <span>
            oldest: <strong className="text-neutral-900">{relativeAge(oldest.createdAt)}</strong>
          </span>
        )}
      </div>

      <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
        {rows.map((order) => {
          const modifiers = formatModifiers(order.selectedModifiers);
          return (
            <li key={order.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  <span className="font-medium">{order.productName}</span>
                  <span className="text-neutral-400"> · qty {order.quantity}</span>
                  {modifiers && <span className="text-neutral-500"> · {modifiers}</span>}
                </p>
                <p className="truncate text-xs text-neutral-500">
                  {order.customerName} · {relativeAge(order.createdAt)}
                  {order.notes ? ` · ${order.notes}` : ""}
                </p>
              </div>
              {order.sourceUrl && (
                <a
                  href={order.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-xs text-blue-600 underline"
                >
                  Listing
                </a>
              )}
              <div className="flex shrink-0 items-center gap-1.5">
                <form action={markPurchasedAction.bind(null, order.id)}>
                  <button
                    type="submit"
                    aria-label="Mark purchased"
                    className="flex h-9 w-9 items-center justify-center rounded-md bg-green-600 text-sm font-bold text-white"
                  >
                    ✓
                  </button>
                </form>
                <form action={cancelOrderAction.bind(null, order.id)}>
                  <button
                    type="submit"
                    aria-label="Cancel order"
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-neutral-300 text-sm"
                  >
                    ✕
                  </button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
