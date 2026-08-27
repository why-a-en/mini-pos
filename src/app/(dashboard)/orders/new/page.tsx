import { notFound, redirect } from "next/navigation";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { withCurrentOrganization } from "@/lib/tenancy";
import { isUuid } from "@/lib/uuid";
import { orders, orderItems, orderItemModifiers, customers, products, modifiers, modifierOptions, productModifierOptions } from "@/db/schema";
import { NewOrderWizard, type WizardProduct, type DraftResume } from "../new-order-wizard";

/** The Customer→Items wizard, as its own route (not a Sheet over the Orders
 *  list — see new-order-wizard.tsx's doc comment for why). Fresh order:
 *  `/orders/new`. Resuming a saved draft: `/orders/new?draft=<orderId>` —
 *  orders-view.tsx links straight here instead of holding wizard state
 *  itself. */
export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const user = await requireUser();
  if (user.role === "supplier") redirect("/orders");

  const { draft: draftId } = await searchParams;
  if (draftId !== undefined && !isUuid(draftId)) notFound();

  const data = await withCurrentOrganization(async ({ organizationId, tx }) => {
    const customerRows = await tx
      .select({ id: customers.id, name: customers.name, phone: customers.phone, address: customers.address })
      .from(customers)
      .where(eq(customers.organizationId, organizationId))
      .orderBy(asc(customers.name))
      .limit(200);

    const productRows = await tx
      .select({ id: products.id, name: products.name, price: products.price, sourceUrl: products.sourceUrl })
      .from(products)
      .where(and(eq(products.organizationId, organizationId), eq(products.status, "active")))
      .orderBy(asc(products.name));

    const activeProductIds = productRows.map((p) => p.id);
    const modifierRows =
      activeProductIds.length === 0
        ? []
        : await tx
            .select({
              productId: productModifierOptions.productId,
              modifierId: modifiers.id,
              modifierName: modifiers.name,
              optionId: modifierOptions.id,
              optionValue: modifierOptions.value,
            })
            .from(productModifierOptions)
            .innerJoin(modifierOptions, eq(modifierOptions.id, productModifierOptions.modifierOptionId))
            .innerJoin(modifiers, eq(modifiers.id, modifierOptions.modifierId))
            .where(inArray(productModifierOptions.productId, activeProductIds))
            .orderBy(asc(modifiers.name), asc(modifierOptions.sortOrder));

    const groupsByProduct = new Map<string, Map<string, { id: string; name: string; options: { id: string; value: string }[] }>>();
    for (const row of modifierRows) {
      const groups = groupsByProduct.get(row.productId) ?? new Map();
      if (!groups.has(row.modifierId)) groups.set(row.modifierId, { id: row.modifierId, name: row.modifierName, options: [] });
      groups.get(row.modifierId)!.options.push({ id: row.optionId, value: row.optionValue });
      groupsByProduct.set(row.productId, groups);
    }

    const wizardProducts: WizardProduct[] = productRows.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      sourceUrl: p.sourceUrl,
      modifierGroups: Array.from(groupsByProduct.get(p.id)?.values() ?? []),
    }));

    if (!draftId) return { wizardCustomers: customerRows, wizardProducts, resume: null as DraftResume | null };

    // A draft is an Order with placed_at still null — resuming one that's
    // already been placed, or that belongs to another org (RLS already
    // scopes the query, so it just comes back empty), is a 404, not a
    // silent reset to a fresh wizard.
    const [order] = await tx
      .select({
        id: orders.id,
        notes: orders.notes,
        customerId: orders.customerId,
        customerName: customers.name,
        customerPhone: customers.phone,
        customerAddress: customers.address,
      })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(and(eq(orders.id, draftId), eq(orders.organizationId, organizationId), isNull(orders.placedAt)));
    if (!order) return { wizardCustomers: customerRows, wizardProducts, resume: undefined };

    const itemRows = await tx
      .select({ id: orderItems.id, quantity: orderItems.quantity, productName: products.name, productPrice: products.price })
      .from(orderItems)
      .innerJoin(products, eq(products.id, orderItems.productId))
      .where(eq(orderItems.orderId, order.id));

    const itemIds = itemRows.map((r) => r.id);
    const selectionRows =
      itemIds.length === 0
        ? []
        : await tx
            .select({ orderItemId: orderItemModifiers.orderItemId, value: modifierOptions.value })
            .from(orderItemModifiers)
            .innerJoin(modifierOptions, eq(modifierOptions.id, orderItemModifiers.modifierOptionId))
            .where(inArray(orderItemModifiers.orderItemId, itemIds));
    const selectionsByItem = new Map<string, string[]>();
    for (const s of selectionRows) {
      const list = selectionsByItem.get(s.orderItemId) ?? [];
      list.push(s.value);
      selectionsByItem.set(s.orderItemId, list);
    }

    const resume: DraftResume = {
      orderId: order.id,
      customer: { id: order.customerId, name: order.customerName, phone: order.customerPhone, address: order.customerAddress },
      notes: order.notes ?? "",
      existingItems: itemRows.map((r) => ({
        productName: r.productName,
        price: r.productPrice,
        selection: selectionsByItem.get(r.id) ?? [],
        quantity: r.quantity,
      })),
    };
    return { wizardCustomers: customerRows, wizardProducts, resume };
  });

  if (data.resume === undefined) notFound();

  return <NewOrderWizard customers={data.wizardCustomers} products={data.wizardProducts} resume={data.resume} />;
}
