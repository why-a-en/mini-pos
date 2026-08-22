// PROTOTYPE, WIPE ME — throwaway seed data for the /orders "Today's Pending
// Orders" (Supplier) UI variant prototype. Not part of the app; lives only
// on the prototype/supplier-pending-orders branch. Safe to re-run: it's
// idempotent on product name and always refreshes the demo orders.
//
// Run: npx tsx scripts/prototype-seed.mts
//
// Creates (under existing "Vendor A"):
//   - a demo login: prototype-demo@mini-pos.local / prototype-demo
//   - 5 catalog products (some with source URLs / modifiers, some without)
//   - ~13 pending orders across them, several duplicating the same product
//     (to make the grouping question judgeable), plus a couple already
//     purchased/cancelled (to confirm the pending filter still holds).
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const { db, withVendorScope } = await import("../src/db/client");
const { vendors, users, products, orders } = await import("../src/db/schema");
const { hashPassword } = await import("../src/lib/auth/hash");
const { eq, inArray } = await import("drizzle-orm");

const allVendors = await db.select().from(vendors);
const vendorA = allVendors.find((v) => v.name === "Vendor A");
if (!vendorA) throw new Error("Expected an existing 'Vendor A' row — none found.");

await withVendorScope(vendorA.id, async (tx) => {
  // --- demo user (so this session can log in and view the prototype) ---
  const demoEmail = "prototype-demo@mini-pos.local";
  let demoUser = (await db.select().from(users).where(eq(users.email, demoEmail)))[0];
  if (!demoUser) {
    const passwordHash = await hashPassword("prototype-demo");
    const [created] = await db
      .insert(users)
      .values({ vendorId: vendorA.id, name: "Prototype Demo", email: demoEmail, passwordHash, role: "admin" })
      .returning();
    demoUser = created;
    console.log(`Created demo login: ${demoEmail} / prototype-demo`);
  } else {
    console.log(`Demo login already exists: ${demoEmail} / prototype-demo`);
  }

  // --- catalog products (create if missing, by name) ---
  const productDefs = [
    {
      name: "Cotton Oversized Tee",
      description: "Boxy fit oversized tee, mid-weight cotton.",
      sourceMarketplace: "tiktok_shop" as const,
      sourceUrl: "https://shop.tiktok.com/view/product/1111111111",
      modifiers: [
        { name: "Color", options: ["Black", "White", "Sage"] },
        { name: "Size", options: ["S", "M", "L", "XL"] },
      ],
    },
    {
      name: "Wireless Earbuds Pro",
      description: "ANC true wireless earbuds, USB-C case.",
      sourceMarketplace: "lazada" as const,
      sourceUrl: "https://www.lazada.co.th/products/2222222222.html",
      modifiers: [{ name: "Color", options: ["Black", "White"] }],
    },
    {
      name: "Ceramic Coffee Mug Set",
      description: "Set of 2 handmade ceramic mugs, 350ml.",
      sourceMarketplace: null,
      sourceUrl: null, // deliberately unknown — Supplier still needs to search
      modifiers: [],
    },
    {
      name: "Canvas Tote Bag",
      description: "Heavy canvas tote, inner pocket.",
      sourceMarketplace: "other" as const,
      sourceUrl: "https://example-marketplace.com/listing/4444",
      modifiers: [{ name: "Color", options: ["Beige", "Black"] }],
    },
    {
      name: "Phone Grip Stand",
      description: "Collapsible phone grip / kickstand.",
      sourceMarketplace: "tiktok_shop" as const,
      sourceUrl: "https://shop.tiktok.com/view/product/5555555555",
      modifiers: [],
    },
  ];

  const productIds: Record<string, string> = {};
  for (const def of productDefs) {
    const existing = (await tx.select().from(products).where(eq(products.name, def.name)))[0];
    if (existing) {
      productIds[def.name] = existing.id;
      continue;
    }
    const [created] = await tx
      .insert(products)
      .values({
        vendorId: vendorA.id,
        name: def.name,
        description: def.description,
        sourceMarketplace: def.sourceMarketplace,
        sourceUrl: def.sourceUrl,
        modifiers: def.modifiers,
        createdBy: demoUser.id,
      })
      .returning();
    productIds[def.name] = created.id;
  }
  console.log(`Products ready: ${Object.keys(productIds).join(", ")}`);

  // --- refresh demo orders: wipe any previous prototype orders for these
  // products, then insert a fresh realistic batch ---
  const ids = Object.values(productIds);
  await tx.delete(orders).where(inArray(orders.productId, ids));

  type OrderDef = {
    product: string;
    customerName: string;
    customerContact?: string;
    selectedModifiers?: Record<string, string>;
    quantity: number;
    notes?: string;
    status?: "pending" | "purchased" | "cancelled";
  };

  const orderDefs: OrderDef[] = [
    // 4 separate customers all want the same tee — the grouping case.
    { product: "Cotton Oversized Tee", customerName: "Mi Mi (FB)", customerContact: "@mimi.shop", selectedModifiers: { Color: "Black", Size: "M" }, quantity: 1 },
    { product: "Cotton Oversized Tee", customerName: "Aung Aung", customerContact: "09-123-4567", selectedModifiers: { Color: "White", Size: "L" }, quantity: 2 },
    { product: "Cotton Oversized Tee", customerName: "Su Su Hlaing", selectedModifiers: { Color: "Black", Size: "S" }, quantity: 1, notes: "Wants it gift-wrapped if possible" },
    { product: "Cotton Oversized Tee", customerName: "Nilar", customerContact: "@nilar.beauty", selectedModifiers: { Color: "Sage", Size: "M" }, quantity: 3 },

    // 3 orders for earbuds
    { product: "Wireless Earbuds Pro", customerName: "Ko Ko Lwin", customerContact: "09-987-6543", selectedModifiers: { Color: "Black" }, quantity: 1 },
    { product: "Wireless Earbuds Pro", customerName: "Hnin Ei", selectedModifiers: { Color: "White" }, quantity: 1 },
    { product: "Wireless Earbuds Pro", customerName: "Zaw Zaw", customerContact: "@zawzaw_tech", selectedModifiers: { Color: "Black" }, quantity: 2, notes: "Asked twice if it's in stock — following up" },

    // 1 order, no source URL — the case the Supplier still has to search manually
    { product: "Ceramic Coffee Mug Set", customerName: "Thandar", customerContact: "09-555-1212", quantity: 1 },

    // 2 orders for tote bag
    { product: "Canvas Tote Bag", customerName: "Yamin", selectedModifiers: { Color: "Beige" }, quantity: 1 },
    { product: "Canvas Tote Bag", customerName: "Phyo Phyo", customerContact: "@phyo.ph", selectedModifiers: { Color: "Black" }, quantity: 1 },

    // Single order, oldest of the batch (to test "sorted by age")
    { product: "Phone Grip Stand", customerName: "Kyaw Kyaw", quantity: 5, notes: "Bulk order for a small shop resale" },

    // Already-resolved orders — must NOT show up in the pending views
    { product: "Wireless Earbuds Pro", customerName: "Old Customer", selectedModifiers: { Color: "White" }, quantity: 1, status: "purchased" },
    { product: "Canvas Tote Bag", customerName: "Cancelled Customer", quantity: 1, status: "cancelled" },
  ];

  // Stagger createdAt so "oldest first" ordering is meaningful (earliest
  // listed above = oldest = most overdue).
  const baseTime = Date.now() - orderDefs.length * 45 * 60 * 1000; // ~45 min apart
  for (const [i, def] of orderDefs.entries()) {
    await tx.insert(orders).values({
      vendorId: vendorA.id,
      productId: productIds[def.product],
      customerName: def.customerName,
      customerContact: def.customerContact ?? null,
      selectedModifiers: def.selectedModifiers ?? {},
      quantity: def.quantity,
      notes: def.notes ?? null,
      status: def.status ?? "pending",
      createdBy: demoUser.id,
      createdAt: new Date(baseTime + i * 45 * 60 * 1000),
      purchasedAt: def.status === "purchased" ? new Date() : null,
    });
  }
  console.log(`Seeded ${orderDefs.length} orders (${orderDefs.filter((o) => !o.status || o.status === "pending").length} pending).`);
});

console.log("\nLog in at /login with prototype-demo@mini-pos.local / prototype-demo");
process.exit(0);
