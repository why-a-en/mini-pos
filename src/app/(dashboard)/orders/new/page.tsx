import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { withCurrentVendor } from "@/lib/tenancy";
import { products } from "@/db/schema";
import { Field, fieldInputClass } from "@/components/form-field";
import { createOrderAction } from "../actions";

// Customer Service's entry point (PRD §7.1) — must stay at least as fast as
// typing a chat message, so this only asks for what the order actually needs.
export default async function NewOrderPage() {
  const availableProducts = await withCurrentVendor(({ vendorId, tx }) =>
    tx
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.vendorId, vendorId))
      .orderBy(asc(products.name)),
  );

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-lg font-semibold">Log a customer order</h1>

      {availableProducts.length === 0 && (
        <p className="text-sm text-amber-600">
          No products yet —{" "}
          <Link href="/products/new" className="underline">
            create one first
          </Link>
          .
        </p>
      )}

      <form action={createOrderAction} className="space-y-4">
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
        <Field label="Customer name">
          <input name="customerName" required className={fieldInputClass} />
        </Field>
        <Field label="Customer contact (optional)">
          <input name="customerContact" className={fieldInputClass} />
        </Field>
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
        <Field label="Notes (optional)">
          <textarea name="notes" rows={3} className={fieldInputClass} />
        </Field>
        <button
          type="submit"
          className="min-h-11 w-full rounded-md bg-neutral-900 px-3 text-base font-medium text-white"
        >
          Save order
        </button>
      </form>
    </div>
  );
}
