import { asc, eq, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { withCurrentOrganization } from "@/lib/tenancy";
import { products, productImages, productModifierOptions, modifierOptions, modifiers } from "@/db/schema";
import { ProductsView, type ProductRowData } from "./products-view";

export default async function ProductsPage() {
  const user = await requireUser();

  const catalog = await withCurrentOrganization(async ({ organizationId, tx }) => {
    const rows = await tx
      .select({
        id: products.id,
        name: products.name,
        price: products.price,
        status: products.status,
        sourceUrl: products.sourceUrl,
      })
      .from(products)
      .where(eq(products.organizationId, organizationId))
      .orderBy(asc(products.name));

    const productIds = rows.map((r) => r.id);
    const [images, modifierRows] = await Promise.all([
      productIds.length === 0
        ? []
        : tx
            .select({ productId: productImages.productId, url: productImages.url })
            .from(productImages)
            .where(inArray(productImages.productId, productIds))
            .orderBy(asc(productImages.sortOrder)),
      productIds.length === 0
        ? []
        : tx
            .select({ productId: productModifierOptions.productId, modifierName: modifiers.name })
            .from(productModifierOptions)
            .innerJoin(modifierOptions, eq(modifierOptions.id, productModifierOptions.modifierOptionId))
            .innerJoin(modifiers, eq(modifiers.id, modifierOptions.modifierId))
            .where(inArray(productModifierOptions.productId, productIds)),
    ]);

    const imageByProduct = new Map<string, string>();
    for (const img of images) if (!imageByProduct.has(img.productId)) imageByProduct.set(img.productId, img.url);
    const modifiersByProduct = new Map<string, Set<string>>();
    for (const m of modifierRows) {
      const set = modifiersByProduct.get(m.productId) ?? new Set<string>();
      set.add(m.modifierName);
      modifiersByProduct.set(m.productId, set);
    }

    return rows.map(
      (r): ProductRowData => ({
        id: r.id,
        name: r.name,
        price: r.price,
        sourceUrl: r.sourceUrl,
        archived: r.status === "archived",
        image: imageByProduct.get(r.id),
        modifiers: Array.from(modifiersByProduct.get(r.id) ?? []),
      }),
    );
  });

  return <ProductsView products={catalog} canCreate={user.role !== "supplier"} />;
}
