"use client";

// PROTOTYPE ONLY. Fires the real markPurchasedAction/cancelOrderAction for
// each id in sequence — no stub, these are the actual mutations already
// live on the single-order flow. Kept generic so variants A and C can both
// reuse it for their "batch" affordances.
import { useTransition } from "react";

export function BatchActionButton({
  orderIds,
  action,
  label,
  pendingLabel,
  className,
}: {
  orderIds: string[];
  action: (orderId: string) => Promise<void>;
  label: string;
  pendingLabel?: string;
  className: string;
}) {
  const [isPending, startTransition] = useTransition();

  if (orderIds.length === 0) return null;

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await Promise.all(orderIds.map((id) => action(id)));
        })
      }
      className={className}
    >
      {isPending ? (pendingLabel ?? "Working…") : label}
    </button>
  );
}
