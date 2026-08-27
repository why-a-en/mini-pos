"use client";

import { useState, useTransition } from "react";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import { Screen, Toolbar, ScrollBody } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { OrderItemRow } from "@/components/ui/order-item-row";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Badge, type OrderItemStatus } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorDialog } from "@/components/ui/error-dialog";
import { markReceivedAction, markPackedAction, markCompletedAction } from "./actions";
import { cancelOrderItemAction } from "../orders/actions";

export type ParcelStage = "purchased" | "received" | "packed";

export interface ParcelItem {
  id: string;
  orderId: string;
  quantity: number;
  status: ParcelStage;
  productName: string;
  customerName: string;
  selection: string[];
  updatedAt: Date | null;
}

const SEGMENTS: { value: ParcelStage | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "purchased", label: "Purchased" },
  { value: "received", label: "Received" },
  { value: "packed", label: "Packed" },
];

const HEADING: Record<ParcelStage | "all", string> = {
  all: "All stages",
  purchased: "Out for purchase",
  received: "Arrived, to pack",
  packed: "Packed, to send",
};

const NEXT: Record<ParcelStage, { status: OrderItemStatus; action: (id: string) => Promise<void>; verb: string }> = {
  purchased: { status: "Received", action: markReceivedAction, verb: "Mark received" },
  received: { status: "Packed", action: markPackedAction, verb: "Mark packed" },
  packed: { status: "Completed", action: markCompletedAction, verb: "Mark completed" },
};

function display(status: ParcelStage): OrderItemStatus {
  return (status.charAt(0).toUpperCase() + status.slice(1)) as OrderItemStatus;
}

export function ParcelsView({ items, status: initialStatus }: { items: ParcelItem[]; status: ParcelStage | "all" }) {
  // shallow: false — a segment change needs the Server Component to re-query
  // with the new status filter, not just update the URL client-side.
  const [status, setStatus] = useQueryState<ParcelStage | "all">("status", {
    defaultValue: "all",
    parse: (v): ParcelStage | "all" => (["purchased", "received", "packed"].includes(v) ? (v as ParcelStage) : "all"),
    serialize: (v) => (v === "all" ? "" : v),
    shallow: false,
  });
  const active = status ?? initialStatus;

  const [open, setOpen] = useState<ParcelItem | null>(null);
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleAdvance(item: ParcelItem) {
    const next = NEXT[item.status];
    setAdvancingId(item.id);
    startTransition(async () => {
      try {
        await next.action(item.id);
        setOpen(null);
        toast.success(`${item.productName} → ${next.status}`);
      } catch (e) {
        // Close the item sheet before raising the error: there's nothing
        // typed in it to lose, and leaving it open would stack two sheets on
        // the same card surface. The row stays in the list to retry from.
        setOpen(null);
        setError(e instanceof Error ? e.message : `Couldn't move ${item.productName} to ${next.status}.`);
      } finally {
        setAdvancingId(null);
      }
    });
  }

  // cancelOrderItemAction already exists (src/app/(dashboard)/orders/actions.ts,
  // used today from the order detail page) and already revalidates both
  // queues — this just gives it a second, more convenient entry point from
  // the row a Customer Service rep is already looking at, rather than
  // inventing new cancel logic.
  function handleCancel(item: ParcelItem) {
    setCancellingId(item.id);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("orderItemId", item.id);
        formData.set("orderId", item.orderId);
        await cancelOrderItemAction(formData);
        setOpen(null);
        toast.success(`${item.productName} cancelled`);
      } catch (e) {
        setOpen(null);
        setError(e instanceof Error ? e.message : `Couldn't cancel ${item.productName}.`);
      } finally {
        setCancellingId(null);
      }
    });
  }

  return (
    <Screen>
      <TopBar backHref="/home" title="Parcels" eyebrow="customer service" />
      <Toolbar>
        <SegmentedControl options={SEGMENTS} value={active} onChange={(v) => setStatus(v === "all" ? null : v)} />
      </Toolbar>
      <ScrollBody>
        <SectionHeader right={`${items.length} items`}>{HEADING[active]}</SectionHeader>
        {items.length ? (
          items.map((item) => (
            <OrderItemRow
              key={item.id}
              product={item.productName}
              selection={item.selection}
              qty={item.quantity}
              status={display(item.status)}
              customer={item.customerName}
              onClick={() => setOpen(item)}
            />
          ))
        ) : (
          <EmptyState icon="box" title="Nothing here." body={active === "received" ? "Nothing has arrived waiting to be packed." : "No items in this stage."} />
        )}
      </ScrollBody>

      <Sheet open={!!open} onOpenChange={(next) => !next && setOpen(null)}>
        <SheetContent>
          <SheetHeader title={open?.productName} />
          {open ? (
            <SheetBody>
              <div className="grid gap-3">
                <Badge status={display(open.status)} size="md" />
                {(
                  [
                    ["Customer", open.customerName],
                    ["Selection", open.selection.length ? open.selection.join(" / ") : "—"],
                    ["Quantity", "×" + open.quantity],
                    ["Updated", open.updatedAt ? new Date(open.updatedAt).toLocaleString() : "—"],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-line-hairline pb-3">
                    <span className="font-mono text-label tracking-label uppercase text-text-faint">{k}</span>
                    <span className="text-right font-ui text-body text-text-strong">{v}</span>
                  </div>
                ))}
              </div>
            </SheetBody>
          ) : null}
          <SheetFooter>
            {open ? (
              <div className="grid gap-2">
                <Button full icon="check" onClick={() => handleAdvance(open)} disabled={advancingId === open.id || cancellingId === open.id}>
                  {advancingId === open.id ? "Working…" : NEXT[open.status].verb}
                </Button>
                <Button
                  full
                  variant="danger"
                  icon="x"
                  onClick={() => handleCancel(open)}
                  disabled={advancingId === open.id || cancellingId === open.id}
                >
                  {cancellingId === open.id ? "Cancelling…" : "Cancel item"}
                </Button>
              </div>
            ) : null}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ErrorDialog open={!!error} message={error} onOk={() => setError(null)} />
    </Screen>
  );
}
