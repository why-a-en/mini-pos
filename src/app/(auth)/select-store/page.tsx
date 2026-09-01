import { requireUser } from "@/lib/auth";
import { withCurrentOrganization } from "@/lib/tenancy";
import { listMyStores } from "@/services/stores";
import { Logo } from "@/components/ui/logo";
import { logoutAction } from "@/app/(dashboard)/actions";
import { Button } from "@/components/ui/button";
import { SelectStoreList } from "./select-store-list";

// In the (auth) group: the dashboard layout redirects here when a member
// has no active Store resolved, so a screen inside that layout would loop.
// Same pattern as /change-password and /onboarding.
export default async function SelectStorePage() {
  await requireUser();
  const stores = (await withCurrentOrganization((ctx) => listMyStores(ctx))).filter(
    (s) => s.status === "active",
  );

  return (
    <main className="ds-grain-surface flex min-h-full flex-1 items-center justify-center bg-surface-page p-4">
      <div className="w-full max-w-[360px] space-y-6">
        <div className="space-y-1">
          <Logo size={32} wordmark />
          <p className="font-ui text-small text-text-muted">
            {stores.length === 0
              ? "You don't have access to any store yet. Ask your Admin to add you to one."
              : "Which store are you working in?"}
          </p>
        </div>

        {stores.length > 0 && <SelectStoreList stores={stores} />}

        {/* Always reachable — this screen is a dead-end for a member with no
            Store grant, and even one who has Stores may have signed in as
            the wrong account. */}
        <form action={logoutAction}>
          <Button full type="submit" variant="secondary" icon="log-out">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
