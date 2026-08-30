import { stopImpersonationAction } from "@/app/(dashboard)/actions";
import { Icon } from "@/components/icon";

/**
 * Shown for the entire duration of an impersonated session.
 *
 * Deliberately impossible to dismiss and pinned above everything else: the
 * failure this prevents is a platform admin forgetting whose account they are
 * in and writing to a client's real data. It is also the only route back —
 * ADR-0002 requires that acting as someone else always be visibly reversible.
 */
export function ImpersonationBanner({ email }: { email: string }) {
  return (
    <div className="sticky top-0 z-50 flex items-center gap-3 border-b border-line-hairline bg-danger-wash px-5 py-2 text-danger">
      <Icon name="triangle-alert" className="shrink-0" />
      <p className="min-w-0 flex-1 font-ui text-small">
        Viewing as <span className="font-medium">{email}</span>
      </p>
      <form action={stopImpersonationAction}>
        <button
          type="submit"
          className="shrink-0 rounded-full border border-current px-3 py-1 font-ui text-small transition-transform duration-instant ease-standard active:scale-95"
        >
          Stop
        </button>
      </form>
    </div>
  );
}
