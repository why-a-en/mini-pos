"use client";

import { useEffect, useMemo, useState, type MouseEventHandler } from "react";
import { Figure } from "@/components/ui/figure";
import { Thumb } from "@/components/ui/thumb";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface BreakdownLine {
  orderItemId: string;
  customer: string;
  selection?: string;
  qty: number;
}

/** The product this system exists for: one Product's whole pending demand,
 *  aggregated across every Order and Customer, with one-tap batch actions —
 *  "Mark purchased" and "Can't source" each act on whichever breakdown rows
 *  are checked, not the whole group unconditionally. A Supplier who can
 *  only source part of the demand unchecks the rest instead of the group
 *  action lying about what actually got bought. */
export function PurchaseGroupCard({
  product,
  image,
  sourceUrl,
  totalQty,
  orderCount,
  breakdown = [],
  onOpenSource,
  onPurchase,
  onCantSource,
  purchasing = false,
  cantSourcing = false,
  expanded: initial = false,
  className,
}: {
  product: string;
  image?: string | null;
  sourceUrl?: string | null;
  totalQty: number;
  orderCount: number;
  breakdown?: BreakdownLine[];
  onOpenSource?: MouseEventHandler<HTMLButtonElement>;
  /** Called with the checked rows' Order Item ids. */
  onPurchase?: (orderItemIds: string[]) => void;
  /** Called with the *unchecked* rows' Order Item ids — the ones set aside
   *  as not going to be fulfilled, not the ones being purchased. */
  onCantSource?: (orderItemIds: string[]) => void;
  /** Pending state from the caller's useTransition, disables both actions
   *  while either Server Action is in flight. */
  purchasing?: boolean;
  cantSourcing?: boolean;
  expanded?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(initial);
  // Default: every line checked, so leaving the breakdown untouched and
  // tapping "Mark purchased" behaves exactly like the old whole-group
  // action did.
  const [checked, setChecked] = useState<Set<string>>(() => new Set(breakdown.map((b) => b.orderItemId)));

  function toggle(id: string) {
    setConfirmingCancel(false);
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Cancelling is permanent — nothing in this app ever moves an Order Item
  // back out of "cancelled" — and there was nothing standing between one tap
  // and it firing. First tap arms it (relabels the button, no request sent
  // yet); a second tap within the window actually cancels. Any other
  // interaction (a checkbox, or the action actually landing) disarms it, so
  // a stale armed button can't fire from an unrelated later tap.
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  useEffect(() => {
    if (!confirmingCancel) return;
    const timer = setTimeout(() => setConfirmingCancel(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmingCancel]);

  const { checkedLines, uncheckedLines } = useMemo(
    () => ({
      checkedLines: breakdown.filter((b) => checked.has(b.orderItemId)),
      uncheckedLines: breakdown.filter((b) => !checked.has(b.orderItemId)),
    }),
    [breakdown, checked],
  );

  function handleCantSourceClick() {
    if (!confirmingCancel) {
      setConfirmingCancel(true);
      return;
    }
    setConfirmingCancel(false);
    onCantSource?.(uncheckedLines.map((b) => b.orderItemId));
  }

  const busy = purchasing || cantSourcing;

  return (
    <div className={cn("overflow-hidden rounded-md border border-line-hairline bg-surface-card shadow-raised", className)}>
      <div className="flex gap-3 p-3.5">
        <Thumb src={image} size={64} label="product" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-ui text-title text-text-strong">{product}</div>
          <button
            type="button"
            onClick={onOpenSource}
            disabled={!sourceUrl}
            className={cn(
              "mt-1 inline-flex items-center gap-1.5 border-none bg-transparent p-0 font-ui text-small-strong underline-offset-[3px] decoration-1 outline-none transition-transform duration-instant ease-standard focus-visible:shadow-[var(--focus-ring)] enabled:active:scale-95",
              // Hueless accent: an accent link is only distinguishable from body
              // ink by its underline, so the underline is not optional.
              sourceUrl ? "cursor-pointer text-accent-text underline" : "cursor-default text-text-faint no-underline",
            )}
          >
            <Icon name={sourceUrl ? "external-link" : "link-2-off"} size={13} />
            {sourceUrl ? "Open listing" : "No listing URL"}
          </button>
        </div>
        <div className="text-right">
          <div className="font-ui text-metric-lg tracking-metric text-text-strong [font-variant-numeric:tabular-nums]">
            <Figure value={totalQty} />
          </div>
          <div className="mt-1 font-mono text-label tracking-label uppercase text-text-faint">to buy</div>
        </div>
      </div>

      {/* Radix Collapsible owns the open/closed wiring — aria-expanded,
          aria-controls and the id pairing between trigger and panel, which
          the hand-rolled version only had half of.
          `border-t` alone: pairing it with `border-none` (as this did) sets
          border-style:none and the divider silently never draws. */}
      <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className="flex w-full cursor-pointer items-center justify-between border-t border-line-hairline bg-surface-sunken px-3.5 py-2 font-ui text-small text-text-muted outline-none transition-colors duration-fast ease-standard hover:text-text-body active:bg-surface-hover focus-visible:shadow-[var(--focus-ring)]"
      >
        <span>
          {orderCount} {orderCount === 1 ? "order" : "orders"}
          {uncheckedLines.length > 0 ? ` · ${uncheckedLines.length} set aside` : ""}
        </span>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={15} />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="bg-surface-sunken px-3.5 pt-0.5 pb-2.5">
          {breakdown.map((b, i) => {
            const on = checked.has(b.orderItemId);
            return (
              <button
                key={b.orderItemId}
                type="button"
                onClick={() => toggle(b.orderItemId)}
                disabled={busy}
                // A checked/unchecked line is a toggle, and it was previously
                // announced as a plain button with the state carried only by
                // a decorative tick and 50% opacity — invisible to a screen
                // reader.
                aria-pressed={on}
                className={cn(
                  "flex w-full items-center gap-2 bg-transparent py-1.5 text-left outline-none transition-[opacity,scale] duration-fast ease-standard active:scale-[0.99]",
                  "focus-visible:shadow-[var(--focus-ring)]",
                  i > 0 && "border-t border-line-hairline",
                  busy ? "cursor-default" : "cursor-pointer",
                  on ? "opacity-100" : "opacity-50",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-[18px] shrink-0 items-center justify-center rounded-xs text-accent-ink",
                    on ? "border border-transparent bg-accent" : "border border-line-strong bg-transparent",
                  )}
                >
                  {on ? <Icon name="check" size={12} /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate font-ui text-small text-text-body">{b.customer}</span>
                {b.selection ? <span className="font-mono text-code text-text-muted">{b.selection}</span> : null}
                <span className="min-w-[26px] text-right font-ui text-small-strong text-text-strong [font-variant-numeric:tabular-nums]">×{b.qty}</span>
              </button>
            );
          })}
        </div>
      </CollapsibleContent>
      </Collapsible>

      {/* Stacked, not side-by-side — two full-width buttons squeezed into
          one row wrapped their own labels onto two lines even after
          shortening them (danger's hatch stripe + icon already eat into a
          "Can't source" button's width before any text). Same
          primary-then-secondary footer shape used everywhere else full-
          width buttons stack in this app (see new-order-wizard.tsx). */}
      <div className="grid gap-2 border-t border-line-hairline p-3">
        <Button full icon="check-check" onClick={() => onPurchase?.(checkedLines.map((b) => b.orderItemId))} disabled={busy || checkedLines.length === 0}>
          {purchasing ? "Marking…" : "Mark purchased"}
        </Button>
        {uncheckedLines.length > 0 ? (
          <Button full variant="danger" icon={confirmingCancel ? "triangle-alert" : "x"} onClick={handleCantSourceClick} disabled={busy}>
            {cantSourcing ? "Marking…" : confirmingCancel ? "Tap again to confirm" : "Can't source the rest"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
