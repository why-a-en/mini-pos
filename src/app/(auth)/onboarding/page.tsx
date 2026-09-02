import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { withCurrentOrganization } from "@/lib/tenancy";
import { listStores } from "@/services/stores";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/(dashboard)/actions";
import { OnboardingSteps } from "./onboarding-steps";

// Deliberately in the (auth) group, not (dashboard) — the first-run gate
// lives in the dashboard layout, so a screen inside it would redirect to
// itself. Same reasoning as /change-password.
//
// Admin-only: requireAdmin() bounces anyone else. In practice nobody else
// reaches it — the gate only fires for role === "admin".
export default async function OnboardingPage() {
  const user = await requireAdmin();
  const stores = await withCurrentOrganization((ctx) => listStores(ctx));

  return (
    <main className="ds-grain-surface flex min-h-full flex-1 items-center justify-center bg-surface-page p-4">
      <div className="w-full max-w-[360px] space-y-6">
        <Logo size={32} wordmark />

        <div className="space-y-1">
          <h1 className="font-display text-display-sm tracking-display text-text-strong">
            Welcome, {user.name}
          </h1>
          <p className="font-ui text-small text-text-faint">
            Signed in as {user.email}
          </p>
          <p className="pt-1 font-ui text-small text-text-muted">
            {stores.length === 0
              ? "Set up your first store. Every order, customer and parcel belongs to one."
              : "Store created. Add someone to your team, or skip and do it later."}
          </p>
        </div>

        <OnboardingSteps stores={stores} />

        {/* No way *forward* out of step 1 — an Organization with no Store
            can't do anything. Step 2 is optional, so it gets a skip. */}
        {stores.length > 0 && (
          <Link
            href="/home"
            className="ds-nav-link block text-center font-ui text-small text-text-muted"
          >
            Skip for now
          </Link>
        )}

        {/* But signing out is always allowed — someone may have logged in as
            the wrong account. */}
        <form action={logoutAction}>
          <Button full type="submit" variant="secondary" size="sm" icon="log-out">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
