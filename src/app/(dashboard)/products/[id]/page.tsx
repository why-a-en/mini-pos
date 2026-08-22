import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { withCurrentVendor } from "@/lib/tenancy";
import { products } from "@/db/schema";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const product = await withCurrentVendor(async ({ vendorId, tx }) => {
    const [row] = await tx
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.vendorId, vendorId)))
      .limit(1);
    return row ?? null;
  });

  if (!product) notFound();

  return (
    <div className="space-y-2">
      <h1 className="text-lg font-semibold">{product.name}</h1>
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
  );
}
