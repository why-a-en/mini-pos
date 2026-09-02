import { requirePlatformAdmin } from "@/lib/auth";
import { listOrganizations } from "@/services/platform";
import { PlatformView } from "./platform-view";

// The platform console — us, the operator. requirePlatformAdmin() redirects
// anyone not on the PLATFORM_ADMIN_USER_IDS allowlist (and anyone currently
// impersonating). Reached from Settings → Platform admin.
export default async function PlatformPage() {
  await requirePlatformAdmin();
  const organizations = await listOrganizations();

  return <PlatformView organizations={organizations} />;
}
