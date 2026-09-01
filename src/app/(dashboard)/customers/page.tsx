import { and, asc, eq } from "drizzle-orm";
import { withCurrentStore } from "@/lib/tenancy";
import { customers } from "@/db/schema";
import { CustomersView } from "./customers-view";

export default async function CustomersPage() {
  const rows = await withCurrentStore(({ organizationId, storeId, tx }) =>
    tx
      .select({ id: customers.id, name: customers.name, phone: customers.phone, address: customers.address })
      .from(customers)
      .where(and(eq(customers.organizationId, organizationId), eq(customers.storeId, storeId)))
      .orderBy(asc(customers.name)),
  );

  return <CustomersView customers={rows} />;
}
