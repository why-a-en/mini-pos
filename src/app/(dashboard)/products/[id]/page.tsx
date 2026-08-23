import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { withCurrentOrganization } from "@/lib/tenancy";
import { products, modifiers, modifierOptions, productModifierOptions } from "@/db/schema";
import { Field, fieldInputClass } from "@/components/form-field";
import {
  attachModifierOptionsAction,
  createModifierAction,
  detachModifierOptionAction,
  setProductStatusAction,
} from "../actions";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const data = await withCurrentOrganization(async ({ organizationId, tx }) => {
    const [product] = await tx
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.organizationId, organizationId)))
      .limit(1);
    if (!product) return null;

    // Every modifier in the org, each with its options and whether that
    // option is already attached to this product — enough to render both
    // "currently attached" and "available to add" in one query.
    const rows = await tx
      .select({
        modifierId: modifiers.id,
        modifierName: modifiers.name,
        optionId: modifierOptions.id,
        optionValue: modifierOptions.value,
        attached: productModifierOptions.id,
      })
      .from(modifiers)
      .innerJoin(modifierOptions, eq(modifierOptions.modifierId, modifiers.id))
      .leftJoin(
        productModifierOptions,
        and(
          eq(productModifierOptions.modifierOptionId, modifierOptions.id),
          eq(productModifierOptions.productId, id),
        ),
      )
      .where(eq(modifiers.organizationId, organizationId))
      .orderBy(asc(modifiers.name), asc(modifierOptions.sortOrder));

    const modifierMap = new Map<
      string,
      { name: string; attached: { id: string; value: string }[]; available: { id: string; value: string }[] }
    >();
    for (const row of rows) {
      if (!modifierMap.has(row.modifierId)) {
        modifierMap.set(row.modifierId, { name: row.modifierName, attached: [], available: [] });
      }
      const entry = modifierMap.get(row.modifierId)!;
      (row.attached ? entry.attached : entry.available).push({
        id: row.optionId,
        value: row.optionValue,
      });
    }

    return { product, modifierGroups: Array.from(modifierMap.entries()) };
  });

  if (!data) notFound();
  const { product, modifierGroups } = data;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">{product.name}</h1>
          <form action={setProductStatusAction.bind(null, product.id, product.status === "active" ? "archived" : "active")}>
            <button type="submit" className="text-sm text-neutral-500 underline">
              {product.status === "active" ? "Archive" : "Unarchive"}
            </button>
          </form>
        </div>
        <p className="text-sm text-neutral-600">{product.description}</p>
        {product.sourceUrl && (
          <a
            href={product.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-600 underline"
          >
            View on {product.sourceMarketplace ?? "marketplace"}
          </a>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-700">Modifiers</h2>

        {modifierGroups.length === 0 && (
          <p className="text-sm text-neutral-500">No modifiers in your catalog yet.</p>
        )}

        {modifierGroups.map(([modifierId, group]) => (
          <div key={modifierId} className="rounded-lg border border-neutral-200 p-3">
            <p className="text-sm font-medium">{group.name}</p>

            {group.attached.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {group.attached.map((option) => (
                  <li key={option.id}>
                    <form action={detachModifierOptionAction.bind(null, product.id, option.id)} className="inline">
                      <button
                        type="submit"
                        className="rounded-full bg-neutral-100 px-3 py-1 text-sm"
                        title="Remove"
                      >
                        {option.value} ✕
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}

            {group.available.length > 0 && (
              <form action={attachModifierOptionsAction} className="mt-2 space-y-2">
                <input type="hidden" name="productId" value={product.id} />
                <div className="flex flex-wrap gap-3">
                  {group.available.map((option) => (
                    <label key={option.id} className="flex items-center gap-1 text-sm">
                      <input type="checkbox" name="modifierOptionIds" value={option.id} />
                      {option.value}
                    </label>
                  ))}
                </div>
                <button type="submit" className="text-sm text-blue-600 underline">
                  Add selected
                </button>
              </form>
            )}
          </div>
        ))}

        <details className="rounded-lg border border-neutral-200 p-3">
          <summary className="cursor-pointer text-sm font-medium">+ New modifier</summary>
          <form action={createModifierAction} className="mt-3 space-y-3">
            <input type="hidden" name="productId" value={product.id} />
            <Field label="Name (e.g. Color, Size)">
              <input name="modifierName" required className={fieldInputClass} />
            </Field>
            <Field label="Options, comma-separated (e.g. Black, White, Red)">
              <input name="options" required className={fieldInputClass} />
            </Field>
            <button
              type="submit"
              className="min-h-11 w-full rounded-md bg-neutral-900 px-3 text-base font-medium text-white"
            >
              Create and attach
            </button>
          </form>
        </details>
      </section>
    </div>
  );
}
