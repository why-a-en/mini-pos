import { and, eq, isNull } from "drizzle-orm";
import { orderItemModifiers, orderItems, orders } from "@/db/schema";
import { ServiceError, type ServiceContext } from "./types";

// Order writes. No `next/*` imports — see ./types.ts and
// docs/ARCHITECTURE_ROADMAP.md §4.

// Unfinished orders pile up silently if there's no ceiling — a Support Agent
// who starts a new one every time a chat gets complicated and rarely circles
// back would otherwise accumulate an unbounded backlog, most of it abandoned
// rather than genuinely paused. Per user (createdBy), not per Organization:
// this is about one agent's own follow-up queue staying workable, not a
// shared org-wide cap.
export const MAX_OPEN_DRAFTS_PER_USER = 5;

export type SaveOrderInput = {
  /** Set when resuming a saved draft; omitted for a brand-new order. */
  orderId?: string;
  customerId: string;
  notes?: string;
  items: { productId: string; modifierOptionIds: string[]; quantity: number }[];
  /** false leaves it as a draft; true stamps placed_at and releases it. */
  place: boolean;
};

/**
 * Creates an Order — or adds to one already started — and inserts any new
 * Order Items plus their modifier selections, in one transaction.
 *
 * The wizard holds the in-progress cart in client state and only commits
 * here, either as a draft (`place: false`, `placed_at` stays null and the
 * order sits in the list to resume) or placed (`place: true`, at which point
 * every new pending Item shows up in the Purchase Queue per PRD §7.1 step 5).
 * An abandoned wizard that was never saved leaves nothing behind.
 */
export async function saveOrder(
  ctx: ServiceContext,
  input: SaveOrderInput,
): Promise<{ orderId: string; placed: boolean }> {
  if (!input.customerId) throw new ServiceError("Missing customer.");

  let id = input.orderId;
  const notes = input.notes?.trim() || null;

  if (id) {
    await ctx.tx
      .update(orders)
      .set({ notes, ...(input.place ? { placedAt: new Date() } : {}) })
      .where(and(eq(orders.id, id), eq(orders.organizationId, ctx.organizationId)));
  } else {
    // Only a brand-new order saved *as a draft* counts against the cap —
    // placing outright never creates a draft in the first place, and updating
    // an already-counted draft (the branch above) isn't starting a new one.
    if (!input.place) {
      const openDrafts = await ctx.tx
        .select({ id: orders.id })
        .from(orders)
        .where(
          and(
            eq(orders.organizationId, ctx.organizationId),
            eq(orders.createdBy, ctx.userId),
            isNull(orders.placedAt),
          ),
        );

      if (openDrafts.length >= MAX_OPEN_DRAFTS_PER_USER) {
        throw new ServiceError(
          `You already have ${MAX_OPEN_DRAFTS_PER_USER} draft orders — finish or place one before starting another.`,
        );
      }
    }

    const [order] = await ctx.tx
      .insert(orders)
      .values({
        organizationId: ctx.organizationId,
        customerId: input.customerId,
        notes,
        createdBy: ctx.userId,
        placedAt: input.place ? new Date() : null,
      })
      .returning({ id: orders.id });
    id = order.id;
  }

  if (input.items.length > 0) {
    const insertedItems = await ctx.tx
      .insert(orderItems)
      .values(
        input.items.map((item) => ({
          organizationId: ctx.organizationId,
          orderId: id!,
          productId: item.productId,
          quantity: item.quantity,
        })),
      )
      .returning({ id: orderItems.id });

    // NOTE: pairs each input item with the inserted row at the same index,
    // which assumes INSERT ... RETURNING hands rows back in the order they
    // were supplied. Postgres does in practice, but the SQL standard does not
    // promise it. Carried over unchanged from the Server Action this was
    // extracted from — worth making order-independent, but that is a
    // behaviour change and does not belong in a move.
    const modifierRows = input.items.flatMap((item, i) =>
      item.modifierOptionIds.map((modifierOptionId) => ({
        organizationId: ctx.organizationId,
        orderItemId: insertedItems[i].id,
        modifierOptionId,
      })),
    );

    if (modifierRows.length > 0) {
      await ctx.tx.insert(orderItemModifiers).values(modifierRows);
    }
  }

  return { orderId: id!, placed: input.place };
}

/**
 * Cancels one Order Item. A soft delete: the row stays, so the Order's notes,
 * the Customer's history and every stage timestamp still reference it — it
 * just drops out of every active view. See ADR-0001 for why Cancelled is
 * reachable from any stage except Completed.
 */
export async function cancelOrderItem(
  ctx: ServiceContext,
  input: { orderItemId: string; reason?: string | null },
): Promise<void> {
  await ctx.tx
    .update(orderItems)
    .set({
      status: "cancelled",
      cancellationReason: input.reason?.trim() || null,
      cancelledAt: new Date(),
    })
    .where(
      and(
        eq(orderItems.id, input.orderItemId),
        eq(orderItems.organizationId, ctx.organizationId),
      ),
    );
}
