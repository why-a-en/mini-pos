import { and, asc, eq, inArray } from "drizzle-orm";
import { withCurrentOrganization } from "@/lib/tenancy";
import { orderItems, orders, products, customers } from "@/db/schema";
import { markReceivedAction, markPackedAction, markCompletedAction } from "./actions";

const STAGES = ["purchased", "received", "packed"] as const;
type Stage = (typeof STAGES)[number];

const NEXT_ACTION: Record<Stage, { label: string; action: (id: string) => Promise<void> }> = {
  purchased: { label: "Mark Received", action: markReceivedAction },
  received: { label: "Mark Packed", action: markPackedAction },
  packed: { label: "Mark Completed", action: markCompletedAction },
};

// Customer Service's view of what's arrived and needs packing (docs/PRD.md
// §6.4) — deliberately separate from the full Order log, since "what needs
// packing today" is a different question from "what did we log today."
export default async function PackingQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const statusFilter: readonly Stage[] =
    status && (STAGES as readonly string[]).includes(status) ? [status as Stage] : STAGES;

  const items = await withCurrentOrganization(({ organizationId, tx }) =>
    tx
      .select({
        id: orderItems.id,
        quantity: orderItems.quantity,
        status: orderItems.status,
        productName: products.name,
        customerName: customers.name,
      })
      .from(orderItems)
      .innerJoin(products, eq(products.id, orderItems.productId))
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(
        and(
          eq(orderItems.organizationId, organizationId),
          inArray(orderItems.status, statusFilter),
        ),
      )
      .orderBy(asc(orderItems.createdAt)),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Packing Queue</h1>

      <div className="flex flex-wrap gap-2 text-sm">
        <a href="/packing-queue" className={!status ? "font-semibold underline" : "text-neutral-500"}>
          All
        </a>
        {STAGES.map((stage) => (
          <a
            key={stage}
            href={`/packing-queue?status=${stage}`}
            className={status === stage ? "font-semibold underline" : "text-neutral-500"}
          >
            {stage}
          </a>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">Nothing here right now.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const next = NEXT_ACTION[item.status as Stage];
            return (
              <li key={item.id} className="rounded-lg border border-neutral-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-sm text-neutral-500">
                      {item.customerName} · qty {item.quantity} · {item.status}
                    </p>
                  </div>
                  {next && (
                    <form action={next.action.bind(null, item.id)} className="shrink-0">
                      <button
                        type="submit"
                        className="min-h-11 rounded-md bg-neutral-900 px-3 text-sm font-medium text-white"
                      >
                        {next.label}
                      </button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
