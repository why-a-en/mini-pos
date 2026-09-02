import { requirePlatformUser } from "@/lib/auth";
import { Screen, ScrollBody } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { ImpersonateForm } from "./impersonate-form";

export default async function ImpersonatePage() {
  await requirePlatformUser();

  return (
    <Screen>
      <TopBar backHref="/platform" title="Impersonate" eyebrow="Operator" />
      <ScrollBody>
        <p className="px-5 py-4 font-ui text-small text-text-muted">
          Step into a client&apos;s account to help. The session becomes theirs — you
          land in the normal app with a banner the whole time, and it&apos;s recorded in
          the audit table permanently.
        </p>
        <ImpersonateForm />
      </ScrollBody>
    </Screen>
  );
}
