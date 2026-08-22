"use server";

import { revalidatePath } from "next/cache";
import { withCurrentVendor } from "@/lib/tenancy";
import { products } from "@/db/schema";

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

  await withCurrentVendor(async ({ vendorId, userId, tx }) => {
    await tx.insert(products).values({
      vendorId,
      name,
      description,
      sourceMarketplace,
      sourceUrl,
      price,
      createdBy: userId,
    });
  });

  revalidatePath("/products");
  revalidatePath("/orders/new");
}
