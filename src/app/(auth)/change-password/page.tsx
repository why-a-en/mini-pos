import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Logo } from "@/components/ui/logo";
import { ChangePasswordForm } from "./change-password-form";

// Deliberately in the (auth) group rather than under (dashboard). The
// forced-change redirect lives in the dashboard layout, so a screen inside
// that layout would redirect to itself forever. Keeping it out of the group
// makes the loop structurally impossible instead of relying on a path check.
export default async function ChangePasswordPage() {
  const user = await requireUser();
  const forced = user.mustChangePassword;

  return (
    <main className="ds-grain-surface flex min-h-full flex-1 items-center justify-center bg-surface-page p-4">
      <div className="w-full max-w-[360px] space-y-6">
        <div className="space-y-1">
          <Logo size={32} wordmark />
          <p className="font-ui text-small text-text-muted">
            {forced
              ? "Your password was set by someone else. Choose your own before continuing."
              : "Change your password."}
          </p>
        </div>

        <ChangePasswordForm forced={forced} />

        {/* No way out while forced — that is the point. Otherwise this is an
            ordinary settings screen and should be leaveable. */}
        {!forced && (
          <Link
            href="/settings"
            className="ds-nav-link block text-center font-ui text-small text-text-muted"
          >
            Back to Settings
          </Link>
        )}
      </div>
    </main>
  );
}
