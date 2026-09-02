import { requirePlatformUser } from "@/lib/auth";
import { Screen, ScrollBody } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { SectionHeader } from "@/components/ui/section-header";
import { Row } from "@/components/ui/row";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { operatorLogoutAction } from "./actions";

// The operator home. Two jobs live here: provisioning client Organizations,
// and stepping into one to help (impersonation).
export default async function PlatformHome() {
  const user = await requirePlatformUser();

  return (
    <Screen>
      <TopBar brand title="Operator" eyebrow={user.email} />
      <ScrollBody>
        <SectionHeader>Manage</SectionHeader>
        <Row href="/platform/organizations">
          <Icon name="inbox" size={18} className="shrink-0 text-text-faint" />
          <span className="flex-1">Organizations</span>
          <Icon name="chevron-right" size={16} className="shrink-0 text-text-faint" />
        </Row>
        <Row href="/platform/impersonate">
          <Icon name="user" size={18} className="shrink-0 text-text-faint" />
          <span className="flex-1">Impersonate a user</span>
          <Icon name="chevron-right" size={16} className="shrink-0 text-text-faint" />
        </Row>

        <div className="px-5 pt-6 pb-8">
          <form action={operatorLogoutAction}>
            <Button full type="submit" variant="secondary" icon="log-out">
              Sign out
            </Button>
          </form>
        </div>
      </ScrollBody>
    </Screen>
  );
}
