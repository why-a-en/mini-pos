"use client";

import { useTransition } from "react";
import { Row } from "@/components/ui/row";
import { Icon } from "@/components/icon";
import { switchOrganizationAction } from "../actions";
import type { AppRole } from "@/lib/auth";

export type SwitchableOrganization = {
  organizationId: string;
  name: string;
  roleLabel: string;
  role: AppRole;
};

/**
 * One Organization at a time, with a switcher — ADR-0002 decision 4. A
 * client component rather than a form per row because `Row` renders a
 * `type="button"`, which can't submit.
 */
export function OrganizationSwitcher({
  organizations,
  activeOrganizationId,
}: {
  organizations: SwitchableOrganization[];
  activeOrganizationId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <>
      {organizations.map((org) => {
        const isActive = org.organizationId === activeOrganizationId;

        return (
          <Row
            key={org.organizationId}
            // The active Organization is a readout, not a destination —
            // omitting onClick makes Row render a plain div, so it isn't
            // focusable or pressable.
            onClick={
              isActive || pending
                ? undefined
                : () => startTransition(() => switchOrganizationAction(org.organizationId))
            }
            className={pending && !isActive ? "opacity-60" : undefined}
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{org.name}</span>
              <span className="font-ui text-small text-text-faint">{org.roleLabel}</span>
            </div>
            {isActive && <Icon name="check" className="shrink-0 text-text-faint" />}
          </Row>
        );
      })}
    </>
  );
}
