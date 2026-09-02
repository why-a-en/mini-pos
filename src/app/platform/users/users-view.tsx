"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Screen, ScrollBody } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { SectionHeader } from "@/components/ui/section-header";
import { Row } from "@/components/ui/row";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import { Icon } from "@/components/icon";
import type { PlatformUserRow } from "@/services/platform";
import { impersonateAction } from "./actions";

const ROLE_LABELS = {
  admin: "Admin",
  support_agent: "Support",
  supplier: "Supplier",
} as const;

function membershipLine(user: PlatformUserRow): string {
  if (user.isOperator) return "Platform operator";
  if (user.memberships.length === 0) return "No organizations";
  return user.memberships.map((m) => `${m.orgName} · ${ROLE_LABELS[m.role]}`).join("   ");
}

export function UsersView({ users }: { users: PlatformUserRow[] }) {
  const [selected, setSelected] = useState<PlatformUserRow | null>(null);

  return (
    <Screen>
      <TopBar backHref="/platform" title="Users" eyebrow="Operator" />
      <ScrollBody>
        <SectionHeader right={`${users.length}`}>Everyone</SectionHeader>

        {users.map((user) => (
          <Row key={user.id} onClick={() => setSelected(user)}>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">
                {user.name}
                {user.isOperator && <span className="text-text-faint"> · operator</span>}
              </span>
              <span className="truncate font-ui text-small text-text-faint">{user.email}</span>
              <span className="truncate font-ui text-small text-text-faint">
                {membershipLine(user)}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {user.memberships.some((m) => m.memberStatus === "suspended") && (
                <span className="font-ui text-small text-danger">Suspended</span>
              )}
              <Icon name="chevron-right" size={16} className="text-text-faint" />
            </div>
          </Row>
        ))}
      </ScrollBody>

      <UserSheet user={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}

function UserSheet({
  user,
  onClose,
}: {
  user: PlatformUserRow | null;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const canImpersonate = user !== null && !user.isOperator && user.memberships.length > 0;

  return (
    <Sheet open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        {user && (
          <>
            <SheetHeader title={user.name} />
            <SheetBody className="grid gap-4">
              <p className="font-ui text-small text-text-faint">{user.email}</p>

              <div className="grid gap-2">
                <span className="font-mono text-label tracking-label uppercase text-text-faint">
                  Memberships
                </span>
                {user.isOperator ? (
                  <p className="font-ui text-small text-text-body">
                    Platform operator — no tenant Organization.
                  </p>
                ) : user.memberships.length === 0 ? (
                  <p className="font-ui text-small text-text-body">None.</p>
                ) : (
                  user.memberships.map((m) => (
                    <div
                      key={m.orgSlug}
                      className="flex items-center justify-between gap-2 rounded-md border border-line-hairline bg-surface-card px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-ui text-small-strong text-text-strong">
                          {m.orgName}
                        </div>
                        <div className="font-ui text-small text-text-faint">
                          {ROLE_LABELS[m.role]}
                          {m.memberStatus === "suspended" && " · suspended"}
                          {m.orgStatus === "suspended" && " · org suspended"}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SheetBody>
            <SheetFooter>
              <Button
                full
                variant="secondary"
                icon="user"
                disabled={!canImpersonate || pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await impersonateAction(user.email);
                    if (result?.error) toast.error(result.error);
                  })
                }
              >
                {canImpersonate ? "Impersonate" : "Can't impersonate"}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
