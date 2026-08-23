import { and, eq, ilike, sql } from "drizzle-orm";
import { withCurrentOrganization } from "@/lib/tenancy";
import { orderItems, products } from "@/db/schema";
import { fieldInputClass } from "@/components/form-field";
import { batchMarkPurchasedAction } from "./actions";

// The Supplier's dedicated home screen (docs/PRD.md §6.3) — the core
// feature: pending Order Items grouped by Product, across every order and
// customer, so today's demand is visible at a glance and clearable in one
// batch tap per product, not by scanning individual orders.
export default async function PurchaseQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const groups = await withCurrentOrganization(({ organizationId, tx }) =>
    tx
      .select({
        productId: products.id,
        productName: products.name,
        sourceUrl: products.sourceUrl,
        sourceMarketplace: products.sourceMarketplace,
        totalQuantity: sql<number>`sum(${orderItems.quantity})`.mapWith(Number),
        orderCount: sql<number>`count(distinct ${orderItems.orderId})`.mapWith(Number),
      })
      .from(orderItems)
      .innerJoin(products, eq(products.id, orderItems.productId))
      .where(
        q
          ? and(
              eq(orderItems.organizationId, organizationId),
              eq(orderItems.status, "pending"),
              ilike(products.name, `%${q}%`),
            )
          : and(eq(orderItems.organizationId, organizationId), eq(orderItems.status, "pending")),
      )
      .groupBy(products.id, products.name, products.sourceUrl, products.sourceMarketplace),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Purchase Queue</h1>

      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search products…"
          className={fieldInputClass}
        />
        <button type="submit" className="min-h-11 shrink-0 rounded-md border border-neutral-300 px-3 text-sm">
          Search
        </button>
      </form>

      {groups.length === 0 ? (
        <p className="text-sm text-neutral-500">Nothing pending — you&apos;re caught up.</p>
      ) : (
        <ul className="space-y-3">
          {groups.map((group) => (
            <li key={group.productId} className="rounded-lg border border-neutral-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{group.productName}</p>
                  <p className="text-sm text-neutral-500">
                    qty {group.totalQuantity} across {group.orderCount}{" "}
                    {group.orderCount === 1 ? "order" : "orders"}
                  </p>
                  {group.sourceUrl && (
                    <a
                      href={group.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-blue-600 underline"
                    >
                      Open on {group.sourceMarketplace ?? "marketplace"}
                    </a>
                  )}
                </div>
                <form action={batchMarkPurchasedAction.bind(null, group.productId)} className="shrink-0">
                  <button
                    type="submit"
                    className="min-h-11 rounded-md bg-green-600 px-3 text-sm font-medium text-white"
                  >
                    Mark all Purchased
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
