import { notFound } from "next/navigation";
import { requirePlatformUser } from "@/lib/auth";
import { isUuid } from "@/lib/uuid";
import { getOrganizationDetail } from "@/services/platform";
import { OrganizationDetailView } from "./organization-detail-view";

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformUser();

  const { id } = await params;
  if (!isUuid(id)) notFound();

  const org = await getOrganizationDetail(id);
  if (!org) notFound();

  return <OrganizationDetailView org={org} />;
}
