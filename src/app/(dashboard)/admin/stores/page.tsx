import { requireAdmin } from "@/lib/auth";
import { withCurrentOrganization } from "@/lib/tenancy";
import { listStores } from "@/services/stores";
import { StoresView } from "./stores-view";

// Admin-only. requireAdmin() redirects a Support Agent or Supplier who
// reaches this URL directly — the route is guarded, not just unlinked.
export default async function StoresPage() {
  await requireAdmin();
  const stores = await withCurrentOrganization((ctx) => listStores(ctx));

  return <StoresView stores={stores} />;
}
