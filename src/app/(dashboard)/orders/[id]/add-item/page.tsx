import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { withCurrentOrganization } from "@/lib/tenancy";
import { products, modifiers, modifierOptions, productModifierOptions } from "@/db/schema";
import { Field, fieldInputClass } from "@/components/form-field";
import { addOrderItemAction } from "../../actions";

// Two steps, both plain server-rendered forms (no client JS): pick a
// product (GET, reloads this page with ?productId=), then configure that
// product's modifiers + quantity (POST, addOrderItemAction).
export default async function AddOrderItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ productId?: string }>;
}) {
  const { id: orderId } = await params;
  const { productId } = await searchParams;

  if (!productId) {
    const availableProducts = await withCurrentOrganization(({ organizationId, tx }) =>
      tx
        .select({ id: products.id, name: products.name })
        .from(products)
        .where(and(eq(products.organizationId, organizationId), eq(products.status, "active")))
        .orderBy(asc(products.name)),
    );

    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-lg font-semibold">Add an item</h1>
        {availableProducts.length === 0 ? (
          <p className="text-sm text-amber-600">No active products yet.</p>
        ) : (
          <form method="get" className="space-y-4">
            <Field label="Product">
              <select name="productId" required defaultValue="" className={fieldInputClass}>
                <option value="" disabled>
                  Select a product…
                </option>
                {availableProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="submit"
              className="min-h-11 w-full rounded-md bg-neutral-900 px-3 text-base font-medium text-white"
            >
              Continue
            </button>
          </form>
        )}
      </div>
    );
  }

  const data = await withCurrentOrganization(async ({ organizationId, tx }) => {
    const [product] = await tx
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(and(eq(products.id, productId), eq(products.organizationId, organizationId)))
      .limit(1);
    if (!product) return null;

    const rows = await tx
      .select({
        modifierId: modifiers.id,
        modifierName: modifiers.name,
        optionId: modifierOptions.id,
        optionValue: modifierOptions.value,
      })
      .from(productModifierOptions)
      .innerJoin(modifierOptions, eq(modifierOptions.id, productModifierOptions.modifierOptionId))
      .innerJoin(modifiers, eq(modifiers.id, modifierOptions.modifierId))
      .where(eq(productModifierOptions.productId, productId))
      .orderBy(asc(modifiers.name), asc(modifierOptions.sortOrder));

    const groups = new Map<string, { name: string; options: { id: string; value: string }[] }>();
    for (const row of rows) {
      if (!groups.has(row.modifierId)) groups.set(row.modifierId, { name: row.modifierName, options: [] });
      groups.get(row.modifierId)!.options.push({ id: row.optionId, value: row.optionValue });
    }

    return { product, modifierGroups: Array.from(groups.entries()) };
  });

  if (!data) notFound();
  const { product, modifierGroups } = data;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-lg font-semibold">Add {product.name}</h1>
      <form action={addOrderItemAction} className="space-y-4">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="productId" value={product.id} />

        {modifierGroups.map(([modifierId, group]) => (
          <Field key={modifierId} label={group.name}>
            <div className="flex flex-wrap gap-3">
              {group.options.map((option) => (
                <label key={option.id} className="flex items-center gap-1 text-sm">
                  <input
                    type="radio"
                    name={`modifierOptionId__${modifierId}`}
                    value={option.id}
                    required
                  />
                  {option.value}
                </label>
              ))}
            </div>
          </Field>
        ))}

        <Field label="Quantity">
          <input
            name="quantity"
            type="number"
            min={1}
            defaultValue={1}
            required
            className={fieldInputClass}
          />
        </Field>

        <button
          type="submit"
          className="min-h-11 w-full rounded-md bg-neutral-900 px-3 text-base font-medium text-white"
        >
          Add to order
        </button>
      </form>
    </div>
  );
}
