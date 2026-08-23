import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { withCurrentOrganization } from "@/lib/tenancy";
import { products } from "@/db/schema";

export default async function ProductsPage() {
  const catalog = await withCurrentOrganization(({ organizationId, tx }) =>
    tx
      .select({
        id: products.id,
        name: products.name,
        status: products.status,
      })
      .from(products)
      .where(eq(products.organizationId, organizationId))
      .orderBy(asc(products.name)),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Products</h1>
        <Link
          href="/products/new"
          className="min-h-11 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
        >
          + New product
        </Link>
      </div>

      {catalog.length === 0 ? (
        <p className="text-sm text-neutral-500">No products yet.</p>
      ) : (
        <ul className="space-y-2">
          {catalog.map((product) => (
            <li key={product.id}>
              <Link
                href={`/products/${product.id}`}
                className="block rounded-lg border border-neutral-200 p-4"
              >
                <p className="font-medium">{product.name}</p>
                <p className="text-sm text-neutral-500">{product.status}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
