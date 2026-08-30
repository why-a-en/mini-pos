import { requireAdmin } from "@/lib/auth";
import { withCurrentOrganization } from "@/lib/tenancy";
import { listStaff } from "@/services/staff";
import { StaffView } from "./staff-view";

// Admin-only. requireAdmin() redirects a Support Agent or Supplier who
// reaches this URL directly — the route is guarded, not just unlinked.
export default async function StaffPage() {
  const user = await requireAdmin();
  const staff = await withCurrentOrganization((ctx) => listStaff(ctx));

  return <StaffView staff={staff} currentUserId={user.id} />;
}
