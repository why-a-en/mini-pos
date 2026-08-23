"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { withCurrentOrganization } from "@/lib/tenancy";
import { products, modifiers, modifierOptions, productModifierOptions } from "@/db/schema";

const MARKETPLACES = ["lazada", "tiktok_shop", "other"] as const;
type Marketplace = (typeof MARKETPLACES)[number];

function parseMarketplace(value: string): Marketplace | null {
  return (MARKETPLACES as readonly string[]).includes(value) ? (value as Marketplace) : null;
}

export async function createProductAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const sourceMarketplace = parseMarketplace(String(formData.get("sourceMarketplace") ?? ""));
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim() || null;
  const price = String(formData.get("price") ?? "").trim() || null;

  if (!name || !description) {
    throw new Error("Name and description are required.");
  }

  const productId = await withCurrentOrganization(async ({ organizationId, userId, tx }) => {
    const [product] = await tx
      .insert(products)
      .values({ organizationId, name, description, sourceMarketplace, sourceUrl, price, createdBy: userId })
      .returning({ id: products.id });
    return product.id;
  });

  revalidatePath("/products");
  redirect(`/products/${productId}`);
}

export async function setProductStatusAction(productId: string, status: "active" | "archived") {
  await withCurrentOrganization(async ({ organizationId, tx }) => {
    await tx
      .update(products)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(products.id, productId), eq(products.organizationId, organizationId)));
  });
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
}

/**
 * Creates a brand-new Modifier (e.g. "Color") with its initial Options
 * (comma-separated, e.g. "Black, White, Red") and immediately attaches all
 * of them to `productId` — the "create a modifier without leaving the
 * product form" flow from docs/PRD.md §5.2.
 */
export async function createModifierAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  const name = String(formData.get("modifierName") ?? "").trim();
  const optionsRaw = String(formData.get("options") ?? "");
  const optionValues = optionsRaw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  if (!productId || !name || optionValues.length === 0) {
    throw new Error("Modifier name and at least one option are required.");
  }

  await withCurrentOrganization(async ({ organizationId, tx }) => {
    const [modifier] = await tx
      .insert(modifiers)
      .values({ organizationId, name })
      .returning({ id: modifiers.id });

    const insertedOptions = await tx
      .insert(modifierOptions)
      .values(
        optionValues.map((value, index) => ({
          organizationId,
          modifierId: modifier.id,
          value,
          sortOrder: index,
        })),
      )
      .returning({ id: modifierOptions.id });

    await tx.insert(productModifierOptions).values(
      insertedOptions.map((option) => ({
        organizationId,
        productId,
        modifierOptionId: option.id,
      })),
    );
  });

  revalidatePath(`/products/${productId}`);
}

/** Attaches a subset of an *existing* Modifier's Options to a product. */
export async function attachModifierOptionsAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  const modifierOptionIds = formData.getAll("modifierOptionIds").map(String);

  if (!productId || modifierOptionIds.length === 0) return;

  await withCurrentOrganization(async ({ organizationId, tx }) => {
    await tx
      .insert(productModifierOptions)
      .values(
        modifierOptionIds.map((modifierOptionId) => ({
          organizationId,
          productId,
          modifierOptionId,
        })),
      )
      .onConflictDoNothing();
  });

  revalidatePath(`/products/${productId}`);
}

export async function detachModifierOptionAction(productId: string, modifierOptionId: string) {
  await withCurrentOrganization(async ({ organizationId, tx }) => {
    await tx
      .delete(productModifierOptions)
      .where(
        and(
          eq(productModifierOptions.organizationId, organizationId),
          eq(productModifierOptions.productId, productId),
          eq(productModifierOptions.modifierOptionId, modifierOptionId),
        ),
      );
  });
  revalidatePath(`/products/${productId}`);
}
