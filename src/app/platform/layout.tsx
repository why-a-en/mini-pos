import type { ReactNode } from "react";
import { requirePlatformUser } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";

// The operator surface — completely separate from the tenant app. No tab
// bar, no Organization/Store scope, no tenant gates. requirePlatformUser()
// bounces a tenant user to `/`; a signed-out visitor to `/login`.
//
// A platform operator has no `members` row and never sees `/orders`,
// `/settings`, etc. — to touch a client's data they impersonate (audited),
// which swaps the session to the target user and drops them into the normal
// tenant app with the banner. See ADR-0002 and src/lib/auth.
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  await requirePlatformUser();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-(--content-max) flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <Toaster />
    </div>
  );
}
