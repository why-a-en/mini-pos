"use client";

// PROTOTYPE — Variant C: "Shopping-list, select then confirm"
//
// Structurally different affordance from A/B: no per-row action buttons at
// all. The Supplier checks off items as they physically buy them (like a
// grocery list), then commits the batch once with a single tap on a
// floating action bar — betting that decoupling "found it" from "confirm
// purchased" matches how buying actually happens (grab several items, pay
// once) better than committing order-by-order.
import { useState, useTransition } from "react";
import { groupByProduct, formatModifiers, type PendingOrderRow } from "./pending-orders-types";
import { markPurchasedAction, cancelOrderAction } from "./actions";

export function PendingOrdersVariantC({ rows }: { rows: PendingOrderRow[] }) {
  const groups = groupByProduct(rows);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleGroup = (ids: string[], checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  };

  const runBatch = (action: (id: string) => Promise<void>) => {
    const ids = Array.from(selected);
    startTransition(async () => {
      await Promise.all(ids.map((id) => action(id)));
      setSelected(new Set());
    });
  };

  return (
    <div className="space-y-4 pb-24">
      <ul className="space-y-4">
        {groups.map((group) => {
          const groupIds = group.orders.map((o) => o.id);
          const allSelected = groupIds.every((id) => selected.has(id));
          return (
            <li key={group.productId} className="rounded-xl border border-neutral-200">
              <div className="flex items-start justify-between gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-3">
                <label className="flex min-w-0 items-start gap-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggleGroup(groupIds, e.target.checked)}
                    className="mt-1 h-5 w-5 shrink-0"
                  />
                  <span className="min-w-0">
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
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm text-blue-600 underline"
                      >
                        Open listing
                      </a>
                    )}
                  </span>
                </label>
              </div>
              <ul className="divide-y divide-neutral-100">
                {group.orders.map((order) => {
                  const modifiers = formatModifiers(order.selectedModifiers);
                  const checked = selected.has(order.id);
                  return (
                    <li key={order.id}>
                      <label
                        className={`flex items-start gap-3 px-4 py-3 ${checked ? "bg-green-50" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(order.id)}
                          className="mt-1 h-5 w-5 shrink-0"
                        />
                        <span className={`min-w-0 text-sm ${checked ? "text-neutral-400 line-through" : ""}`}>
                          <span className="font-medium not-italic">{order.customerName}</span>
                          <span className="ml-2">qty {order.quantity}</span>
                          {modifiers && <span className="block text-neutral-500">{modifiers}</span>}
                          {order.notes && <span className="block italic text-neutral-500">{order.notes}</span>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>

      {selected.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 shadow-lg">
            <span className="shrink-0 text-sm font-medium">{selected.size} selected</span>
            <div className="flex flex-1 justify-end gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => runBatch(cancelOrderAction)}
                className="min-h-11 rounded-md border border-neutral-300 px-3 text-sm font-medium disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => runBatch(markPurchasedAction)}
                className="min-h-11 rounded-md bg-green-600 px-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {isPending ? "Marking…" : `Mark ${selected.size} Purchased`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
