import { isPlatformAdmin, listMemberships, requireUser, roleLabel, type AppRole } from "@/lib/auth";
import { OrganizationSwitcher } from "./organization-switcher";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { startImpersonationAction } from "../actions";
import { Screen, ScrollBody } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { SectionHeader } from "@/components/ui/section-header";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
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

        {/* Not a platform-admin console — ADR-0002 defers that. Just enough
            to act on a client's support request, gated on the
            PLATFORM_ADMIN_USER_IDS allowlist. Hidden while already
            impersonating, since nesting one inside another has no meaning. */}
        {isPlatformAdmin(user.id) && !user.impersonatedBy && (
          <>
            <SectionHeader>Platform admin</SectionHeader>
            <form action={startImpersonationAction} className="grid gap-3 px-5 py-3">
              <Field
                label="View as user"
                hint="Every impersonated session is recorded permanently."
              >
                <Input name="email" type="email" placeholder="cs@client.com" icon="at-sign" />
              </Field>
              <Button type="submit" variant="secondary" icon="user-plus">
                Start impersonating
              </Button>
            </form>
          </>
        )}

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
