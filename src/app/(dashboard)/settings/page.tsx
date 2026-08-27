import { requireUser, roleLabel } from "@/lib/auth";
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

  return (
    <Screen>
      <TopBar brand title="Settings" eyebrow={roleLabel(user.role)} />
      <ScrollBody>
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
