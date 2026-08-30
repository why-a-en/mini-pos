"use client";

import { useQueryState } from "nuqs";
import { Screen, Toolbar, ScrollBody } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { IconButton } from "@/components/ui/icon-button";
import { SearchField } from "@/components/ui/search-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { EmptyState } from "@/components/ui/empty-state";
import { Row } from "@/components/ui/row";
import { Icon } from "@/components/icon";
import { dateWindowSentence, type DateWindow } from "@/lib/date-range";
import type { DraftResume } from "./new-order-wizard";

// Order itself carries no status column — status lives on Order Item (see
// docs/adr/0001-order-item-lifecycle-and-packing.md), since one Order can
// span several Items in different stages at once. The one real order-level
// state is whether it's been placed yet (orders.placedAt), so that's what
// this filters by. The list itself shows each order's date rather than a
// Draft/Placed chip — the filter above already answers that question, and
// the per-item summary line answers the more useful one.
type OrderStatus = "all" | "draft" | "placed";

const STATUS_SEGMENTS: { value: OrderStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "placed", label: "Placed" },
];

export interface OrderRowData {
  id: string;
  customerName: string;
  /** Preformatted on the server — see formatOrderDate in page.tsx. */
  createdAtLabel: string;
  itemStatuses: string[];
  /** Non-null when the order hasn't been placed yet (placed_at is null) —
   *  tapping the row resumes the wizard (at /orders/new?draft=<id>) instead
   *  of opening the detail page. */
  draft: DraftResume | null;
}

function summarize(statuses: string[]): string {
  if (statuses.length === 0) return "no items yet";
  const counts = new Map<string, number>();
  for (const s of statuses) counts.set(s, (counts.get(s) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([status, count]) => `${count} ${status}`)
    .join(", ");
}

export function OrdersView({ orders, canCreate, window: dateWindow }: { orders: OrderRowData[]; canCreate: boolean; window: DateWindow }) {
  // Both filters live in the URL (nuqs) so a filtered/searched view is
  // shareable and survives back/forward — filtering itself still happens
  // client-side over the already-fetched page (see page.tsx), so there's no
  // need for shallow: false here the way the Parcels status filter needs it.
  const [q, setQ] = useQueryState("q", { defaultValue: "" });
  const [status, setStatus] = useQueryState<OrderStatus>("status", {
    defaultValue: "all",
    parse: (v): OrderStatus => (v === "draft" || v === "placed" ? v : "all"),
    serialize: (v) => (v === "all" ? "" : v),
  });

  const rangeLabel = dateWindowSentence(dateWindow);
  const dateFiltered = dateWindow.custom || dateWindow.range !== "all";

  const filtered = orders
    .filter((o) => o.customerName.toLowerCase().includes(q.toLowerCase()))
    .filter((o) => status === "all" || (status === "draft" ? o.draft !== null : o.draft === null));

  return (
    <Screen>
      <TopBar
        brand
        title="Orders"
        eyebrow={`${orders.length} recent`}
        right={
          canCreate ? <IconButton icon="plus" label="New order" href="/orders/new" size="icon-sm" /> : null
        }
      />
      {/* Search and the date trigger share one row — the date control stays
          narrow (icon-only until a window is picked) so search keeps the
          space it needs to be typed into on a phone. */}
      <Toolbar className="pb-2">
        <SearchField
          value={q}
          onChange={(e) => setQ(e.target.value || null)}
          onClear={() => setQ(null)}
          placeholder="Search by customer"
          trailing={<DateRangeFilter window={dateWindow} />}
        />
      </Toolbar>
      <Toolbar className="pt-0">
        <SegmentedControl options={STATUS_SEGMENTS} value={status} onChange={(v) => setStatus(v === "all" ? null : v)} />
      </Toolbar>
      <ScrollBody>
        {filtered.length === 0 ? (
          <EmptyState
            icon="receipt"
            title={q || status !== "all" || dateFiltered ? "No match." : "No orders yet."}
            body={
              q
                ? `No orders under that name${rangeLabel ? " " + rangeLabel : ""}.`
                : status !== "all"
                  ? `No ${status} orders${rangeLabel ? " " + rangeLabel : ""}.`
                  : rangeLabel
                    ? `No orders ${rangeLabel}.`
                    : "Log the first one from a customer chat."
            }
          />
        ) : (
          filtered.map((order) => (
            <Row key={order.id} href={order.draft ? `/orders/new?draft=${order.id}` : `/orders/${order.id}`} className="min-h-[62px]">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-ui text-body-strong text-text-strong">{order.customerName}</span>
                <span className="mt-0.5 block truncate font-ui text-small text-text-faint">
                  {order.draft ? `Draft — ${order.draft.existingItems.length} items` : summarize(order.itemStatuses)}
                </span>
              </span>
              {/* When the order was logged, not what state it's in — the
                  per-item statuses already read out in the line above, and a
                  Draft/Placed chip repeated down the whole list said less
                  than the date does. */}
              <time className="shrink-0 font-mono text-label tracking-label uppercase text-text-faint [font-variant-numeric:tabular-nums]">
                {order.createdAtLabel}
              </time>
              <Icon name="chevron-right" size={16} color="var(--color-text-faint)" />
            </Row>
          ))
        )}
      </ScrollBody>
    </Screen>
  );
}
