import { isPlatformAdmin, listMemberships, requireUser, roleLabel, type AppRole } from "@/lib/auth";
import { withCurrentOrganization } from "@/lib/tenancy";
import { listMyStores } from "@/services/stores";
import { OrganizationSwitcher } from "./organization-switcher";
import { StoreSwitcher } from "./store-switcher";
import { ImpersonationForm } from "./impersonation-form";
import { Screen, ScrollBody } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { SectionHeader } from "@/components/ui/section-header";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Row } from "@/components/ui/row";
import { Icon } from "@/components/icon";
import { logoutAction } from "../actions";

// Phase-1 scope only: the design kit's fuller SettingsScreen also has a
// customers list, time zone, and a role-landing switch — the last one is a
// dev-only artifact of the kit's fake-role-switch pattern and doesn't apply
// to our real auth-derived roles. This tab exists at all only because moving
// to a bottom-tab shell needed a landing spot for what the old top-nav
// header held directly: sign-out, plus the theme toggle the new dark-default
// token system now needs.
export default async function SettingsPage() {
  const user = await requireUser();

  // Only Organizations the user can actually switch into: a suspended one
  // would resolve to no session and bounce them to /login.
  const switchable = (await listMemberships(user.id))
    .filter((m) => m.status === "active")
    .map((m) => ({
      organizationId: m.organizationId,
      name: m.name,
      role: m.role as AppRole,
      roleLabel: roleLabel(m.role as AppRole),
    }));

  // Only Stores this member can actually work in, and only the ones still
  // active — a suspended one would bounce them straight back to
  // /select-store.
  const myStores = (await withCurrentOrganization((ctx) => listMyStores(ctx))).filter(
    (s) => s.status === "active",
  );

  return (
    <Screen>
      <TopBar brand title="Settings" eyebrow={roleLabel(user.role)} />
      <ScrollBody>
        {/* Hidden entirely for the common case of one membership — a
            switcher with a single option is just a confusing readout. */}
        {switchable.length > 1 && (
          <>
            <SectionHeader>Organization</SectionHeader>
            <OrganizationSwitcher
              organizations={switchable}
              activeOrganizationId={user.organizationId}
            />
          </>
        )}

        {/* Same rule as the Organization switcher above — hidden entirely
            when there's only one Store to be in. */}
        {myStores.length > 1 && (
          <>
            <SectionHeader>Store</SectionHeader>
            <StoreSwitcher stores={myStores} activeStoreId={user.storeId} />
          </>
        )}

        <SectionHeader>Appearance</SectionHeader>
        <div className="flex items-center justify-between gap-3 border-b border-line-hairline px-5 py-3">
          <span>Theme</span>
          <ThemeToggle />
        </div>

        <SectionHeader>Session</SectionHeader>
        <div className="flex items-center justify-between gap-3 border-b border-line-hairline px-5 py-3">
          <span>{user.name}</span>
          <span className="font-ui text-small text-text-faint">{user.email}</span>
        </div>

        {/* Operator-only, gated on the PLATFORM_ADMIN_USER_IDS allowlist —
            provisioning client Organizations (/platform) and acting on a
            support request (impersonation). Hidden while already
            impersonating: you can't provision clients as a client's user,
            and nesting one impersonation in another has no meaning. */}
        {isPlatformAdmin(user.id) && !user.impersonatedBy && (
          <>
            <SectionHeader>Platform admin</SectionHeader>
            <Row href="/platform">
              <span className="flex-1">Organizations</span>
              <Icon name="chevron-right" size={16} className="shrink-0 text-text-faint" />
            </Row>
            <ImpersonationForm />
          </>
        )}

        <Row href="/change-password">
          <span className="flex-1">Change password</span>
          <Icon name="chevron-right" size={16} className="shrink-0 text-text-faint" />
        </Row>

        <div className="px-5 pt-5 pb-8">
          <form action={logoutAction}>
            <Button full type="submit" variant="secondary" icon="log-out">
              Sign out
            </Button>
          </form>
        </div>
      </ScrollBody>
    </Screen>
  );
}
