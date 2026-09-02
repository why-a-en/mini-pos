import { requirePlatformUser } from "@/lib/auth";
import { listOrganizations } from "@/services/platform";
import { OrganizationsView } from "./organizations-view";

export default async function OrganizationsPage() {
  await requirePlatformUser();
  const organizations = await listOrganizations();

  return <OrganizationsView organizations={organizations} />;
}
