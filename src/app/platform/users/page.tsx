import { requirePlatformUser } from "@/lib/auth";
import { listUsers } from "@/services/platform";
import { UsersView } from "./users-view";

export default async function UsersPage() {
  await requirePlatformUser();
  const users = await listUsers();

  return <UsersView users={users} />;
}
