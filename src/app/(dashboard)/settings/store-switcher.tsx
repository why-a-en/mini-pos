"use client";

import { useTransition } from "react";
import { Row } from "@/components/ui/row";
import { Icon } from "@/components/icon";
import type { Store } from "@/services/stores";
import { switchStoreAction } from "../actions";

/**
 * The Store equivalent of OrganizationSwitcher — same shape, one level
 * down. Only rendered when the member can work in 2+ Stores; a single one
 * resolves silently and needs no control.
 */
export function StoreSwitcher({
  stores,
  activeStoreId,
}: {
  stores: Store[];
  activeStoreId: string | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <>
      {stores.map((store) => {
        const isActive = store.id === activeStoreId;
        return (
          <Row
            key={store.id}
            onClick={
              isActive || pending
                ? undefined
                : () => startTransition(() => switchStoreAction(store.id))
            }
            className={pending && !isActive ? "opacity-60" : undefined}
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{store.name}</span>
              {store.status === "suspended" && (
                <span className="font-ui text-small text-danger">Suspended</span>
              )}
            </div>
            {isActive && <Icon name="check" className="shrink-0 text-text-faint" />}
          </Row>
        );
      })}
    </>
  );
}
