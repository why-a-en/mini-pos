import { asc, eq, ilike, and } from "drizzle-orm";
import { withCurrentOrganization } from "@/lib/tenancy";
import { customers } from "@/db/schema";
import { Field, fieldInputClass } from "@/components/form-field";
import { createOrderAction } from "../actions";

// Customer Service's entry point (PRD §7.1) — customer is search-or-create,
// same pattern as modifiers on a product. Items get added on the next
// screen (order detail), one at a time, as the chat reveals more requests.
export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const matches = await withCurrentOrganization(({ organizationId, tx }) =>
    tx
      .select({ id: customers.id, name: customers.name, contact: customers.contact })
      .from(customers)
      .where(
        q
          ? and(eq(customers.organizationId, organizationId), ilike(customers.name, `%${q}%`))
          : eq(customers.organizationId, organizationId),
      )
      .orderBy(asc(customers.name))
      .limit(20),
  );

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-lg font-semibold">Log a customer order</h1>

      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search customers…"
          className={fieldInputClass}
        />
        <button type="submit" className="min-h-11 shrink-0 rounded-md border border-neutral-300 px-3 text-sm">
          Search
        </button>
      </form>

      <form action={createOrderAction} className="space-y-4">
        <Field label="Customer">
          <select name="existingCustomerId" defaultValue="" className={fieldInputClass}>
            <option value="">Select a customer…</option>
            {matches.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
                {customer.contact ? ` (${customer.contact})` : ""}
              </option>
            ))}
          </select>
        </Field>

        <details className="rounded-lg border border-neutral-200 p-3">
          <summary className="cursor-pointer text-sm font-medium">+ New customer instead</summary>
          <div className="mt-3 space-y-3">
            <Field label="Name">
              <input name="newCustomerName" className={fieldInputClass} />
            </Field>
            <Field label="Contact (phone, social handle, etc.)">
              <input name="newCustomerContact" className={fieldInputClass} />
            </Field>
          </div>
        </details>

        <Field label="Notes (optional)">
          <textarea name="notes" rows={3} className={fieldInputClass} />
        </Field>
        {/* TODO: screenshot upload — same deferred-to-/prototype call as product images. */}

        <button
          type="submit"
          className="min-h-11 w-full rounded-md bg-neutral-900 px-3 text-base font-medium text-white"
        >
          Start order — add items next
        </button>
      </form>
    </div>
  );
}
