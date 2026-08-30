"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Screen, ScrollBody } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { SectionHeader } from "@/components/ui/section-header";
import { Row } from "@/components/ui/row";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import { Icon } from "@/components/icon";
import type { StaffMember } from "@/services/staff";
import type { AppRole } from "@/services/types";
import {
  addStaffAction,
  changeStaffRoleAction,
  removeStaffAction,
  setStaffStatusAction,
} from "./actions";

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "support_agent", label: "Support" },
  { value: "supplier", label: "Supplier" },
  { value: "admin", label: "Admin" },
];

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  support_agent: "Support Agent",
  supplier: "Supplier",
};

export function StaffView({
  staff,
  currentUserId,
}: {
  staff: StaffMember[];
  currentUserId: string;
}) {
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<StaffMember | null>(null);

  return (
    <Screen>
      {/* Reached from Home, not a tab — so it leads with a back arrow.
          See CLAUDE.md's "every nested screen has a back button". */}
      <TopBar backHref="/home" title="Staff" />
      <ScrollBody>
        <SectionHeader right={`${staff.length}`}>Team</SectionHeader>

        {staff.map((member) => {
          const isSelf = member.userId === currentUserId;
          return (
            <Row key={member.memberId} onClick={isSelf ? undefined : () => setSelected(member)}>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">
                  {member.name}
                  {isSelf && <span className="text-text-faint"> (you)</span>}
                </span>
                <span className="truncate font-ui text-small text-text-faint">
                  {member.email}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {member.status === "suspended" && (
                  <span className="font-ui text-small text-danger">Suspended</span>
                )}
                <span className="font-ui text-small text-text-faint">
                  {ROLE_LABELS[member.role]}
                </span>
                {!isSelf && <Icon name="chevron-right" size={16} className="text-text-faint" />}
              </div>
            </Row>
          );
        })}

        <div className="px-5 pt-5 pb-8">
          <Button full variant="secondary" icon="user-plus" onClick={() => setAdding(true)}>
            Add staff
          </Button>
        </div>
      </ScrollBody>

      <AddStaffSheet open={adding} onOpenChange={setAdding} />
      <ManageStaffSheet member={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}

function AddStaffSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [role, setRole] = useState<AppRole>("support_agent");
  const [state, formAction, pending] = useActionState(addStaffAction, undefined);

  // Closing on success is driven by the action's own result rather than a
  // separate success flag, so the sheet can't close over a failed submit.
  if (state && !state.error && open) onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader title="Add staff" />
        <form action={formAction}>
          <SheetBody className="grid gap-4">
            <Field label="Name" required>
              <Input name="name" autoComplete="off" />
            </Field>
            <Field label="Email" required>
              <Input name="email" type="email" autoComplete="off" icon="at-sign" />
            </Field>
            <Field
              label="Temporary password"
              required
              hint="Give this to them directly — no invitation email is sent."
            >
              <Input name="password" type="text" autoComplete="off" icon="lock" />
            </Field>
            <Field label="Role" required>
              <SegmentedControl options={ROLE_OPTIONS} value={role} onChange={setRole} />
              <input type="hidden" name="role" value={role} />
            </Field>
            {state?.error && (
              <p className="font-ui text-small text-danger">{state.error}</p>
            )}
          </SheetBody>
          <SheetFooter>
            <Button full type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add to Organization"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ManageStaffSheet({
  member,
  onClose,
}: {
  member: StaffMember | null;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        // Service rules — "last active Admin", "can't remove yourself" —
        // surface as toasts rather than silently doing nothing.
        toast.error(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <Sheet open={member !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        {member && (
          <>
            <SheetHeader title={member.name} />
            <SheetBody className="grid gap-5">
              <Field label="Role">
                <SegmentedControl
                  options={ROLE_OPTIONS}
                  value={member.role}
                  onChange={(role) =>
                    run(() => changeStaffRoleAction(member.memberId, role))
                  }
                />
              </Field>

              <div className="grid gap-3">
                <Button
                  full
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      setStaffStatusAction(
                        member.memberId,
                        member.status === "suspended" ? "active" : "suspended",
                      ),
                    )
                  }
                >
                  {member.status === "suspended" ? "Restore access" : "Suspend access"}
                </Button>

                {/* Removal drops the membership; their Orders and Products
                    stay attributed to them. Suspending is the reversible
                    option, so it comes first. */}
                <Button
                  full
                  variant="danger"
                  disabled={pending}
                  onClick={() => run(() => removeStaffAction(member.memberId))}
                >
                  Remove from Organization
                </Button>
              </div>
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
