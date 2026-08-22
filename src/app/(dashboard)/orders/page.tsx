import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { withCurrentVendor } from "@/lib/tenancy";
import { orders, products } from "@/db/schema";
import type { PendingOrderRow } from "./pending-orders-types";
import { PendingOrdersVariantA } from "./pending-orders-variant-a";
import { PendingOrdersVariantB } from "./pending-orders-variant-b";
import { PendingOrdersVariantC } from "./pending-orders-variant-c";
import { PrototypeSwitcher } from "./prototype-switcher";

// PROTOTYPE (/prototype UI.md, sub-shape A): three variants of the
// Supplier's core screen (PRD §6.3) live on this real route, switchable via
// ?variant=, gated out of production builds. Data fetching/auth below is
// untouched real code; only the rendered subtree swaps per variant.
// See scripts/prototype-seed.mts for demo data and the "prototype/
// supplier-pending-orders" branch for the full variant set once this is
// folded into a single decision.
const VARIANTS = [
  { key: "A", label: "Grouped by product" },
  { key: "B", label: "Flat, oldest-first" },
  { key: "C", label: "Shopping-list, select+confirm" },
] as const;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const { variant: rawVariant } = await searchParams;
  const variant = VARIANTS.some((v) => v.key === rawVariant) ? rawVariant! : "A";
  const isPrototype = process.env.NODE_ENV !== "production";

  const rawPendingOrders = await withCurrentVendor(({ vendorId, tx }) =>
    tx
      .select({
        id: orders.id,
        productId: orders.productId,
        productName: products.name,
        sourceUrl: products.sourceUrl,
        customerName: orders.customerName,
        customerContact: orders.customerContact,
        selectedModifiers: orders.selectedModifiers,
        quantity: orders.quantity,
        notes: orders.notes,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .innerJoin(products, eq(orders.productId, products.id))
      .where(and(eq(orders.vendorId, vendorId), eq(orders.status, "pending")))
      .orderBy(asc(orders.createdAt)),
  );
  // selectedModifiers is stored as jsonb (untyped); the shape is documented
  // in docs/DATA_MODEL.md as Record<string, string> ({"Color": "Black"}).
  const pendingOrders: PendingOrderRow[] = rawPendingOrders.map((row) => ({
    ...row,
    selectedModifiers: (row.selectedModifiers ?? {}) as Record<string, string>,
  }));

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
        <>
          {variant === "A" && <PendingOrdersVariantA rows={pendingOrders} />}
          {variant === "B" && <PendingOrdersVariantB rows={pendingOrders} />}
          {variant === "C" && <PendingOrdersVariantC rows={pendingOrders} />}
        </>
      )}

      {isPrototype && (
        <PrototypeSwitcher variants={VARIANTS.map((v) => ({ key: v.key, label: v.label }))} current={variant} />
      )}
    </div>
  );
}
