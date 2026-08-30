"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Screen, ScrollBody, Toolbar } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { SearchField } from "@/components/ui/search-field";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { StatTile } from "@/components/ui/stat-tile";
import { PurchaseGroupCard } from "@/components/ui/purchase-group-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorDialog } from "@/components/ui/error-dialog";
import { dateWindowSentence, type DateWindow } from "@/lib/date-range";
import { markPurchasedAction, cantSourceAction } from "./actions";

export interface PurchaseGroup {
  productId: string;
  productName: string;
  sourceUrl: string | null;
  imageUrl?: string;
  totalQuantity: number;
  orderCount: number;
  breakdown: { orderItemId: string; customer: string; selection?: string; qty: number }[];
}

// Which product's card has an action in flight, and which of its two
// actions — a card can only run one at a time, but different cards could in
// principle overlap, hence keyed by productId rather than one flag.
interface Busy {
  productId: string;
  kind: "purchase" | "cantSource";
}

export function PurchaseQueueView({ groups, window: dateWindow }: { groups: PurchaseGroup[]; window: DateWindow }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<Busy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const rangeLabel = dateWindowSentence(dateWindow);
  const dateFiltered = dateWindow.custom || dateWindow.range !== "all";
  const filtered = groups.filter((g) => g.productName.toLowerCase().includes(q.toLowerCase()));
  const totalUnits = groups.reduce((n, g) => n + g.totalQuantity, 0);

  function handlePurchase(group: PurchaseGroup, orderItemIds: string[]) {
    if (orderItemIds.length === 0) return;
    setBusy({ productId: group.productId, kind: "purchase" });
    startTransition(async () => {
      try {
        await markPurchasedAction(orderItemIds);
        const qty = group.breakdown.filter((b) => orderItemIds.includes(b.orderItemId)).reduce((n, b) => n + b.qty, 0);
        toast.success(`${qty} × ${group.productName} purchased`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't mark that purchased.");
      } finally {
        setBusy(null);
      }
    });
  }

  function handleCantSource(group: PurchaseGroup, orderItemIds: string[]) {
    if (orderItemIds.length === 0) return;
    setBusy({ productId: group.productId, kind: "cantSource" });
    startTransition(async () => {
      try {
        await cantSourceAction(orderItemIds);
        const qty = group.breakdown.filter((b) => orderItemIds.includes(b.orderItemId)).reduce((n, b) => n + b.qty, 0);
        toast.success(`${qty} × ${group.productName} marked can't source`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't mark that as unsourceable.");
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <Screen>
      <TopBar brand title="To purchase" eyebrow="supplier" />
      <ScrollBody>
        <div className="grid grid-cols-2 gap-2 px-5 pt-2 pb-3">
          <StatTile value={totalUnits} label="units to buy" />
          <StatTile value={groups.length} label="products" />
        </div>
        {/* Same one-row pairing as the Orders log — now the same call, not
            the same layout retyped. */}
        <Toolbar>
          <SearchField
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onClear={() => setQ("")}
            placeholder="Search products"
            trailing={<DateRangeFilter window={dateWindow} />}
          />
        </Toolbar>
        {filtered.length ? (
          <div className="grid gap-3 px-5 pb-12">
            {filtered.map((g) => (
              <PurchaseGroupCard
                key={g.productId}
                product={g.productName}
                image={g.imageUrl}
                sourceUrl={g.sourceUrl}
                totalQty={g.totalQuantity}
                orderCount={g.orderCount}
                breakdown={g.breakdown}
                purchasing={busy?.productId === g.productId && busy.kind === "purchase"}
                cantSourcing={busy?.productId === g.productId && busy.kind === "cantSource"}
                onPurchase={(orderItemIds) => handlePurchase(g, orderItemIds)}
                onCantSource={(orderItemIds) => handleCantSource(g, orderItemIds)}
                onOpenSource={g.sourceUrl ? () => window.open(g.sourceUrl!, "_blank", "noreferrer") : undefined}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="check-check"
            title={q || dateFiltered ? "No match." : "Queue's clear."}
            body={
              q
                ? `Nothing pending under that name${rangeLabel ? " " + rangeLabel : ""}.`
                : rangeLabel
                  ? `Nothing was ordered ${rangeLabel}.`
                  : "Nothing pending today."
            }
          />
        )}
      </ScrollBody>
      <ErrorDialog open={!!error} message={error} onOk={() => setError(null)} />
    </Screen>
  );
}
