"use client";

import { useTransition } from "react";
import { Row } from "@/components/ui/row";
import { Icon } from "@/components/icon";
import type { Store } from "@/services/stores";
import { selectStoreAction } from "./actions";

export function SelectStoreList({ stores }: { stores: Store[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="overflow-hidden rounded-md border border-line-hairline bg-surface-card">
      {stores.map((store, i) => (
        <Row
          key={store.id}
          className={i < stores.length - 1 ? "border-b border-line-hairline" : undefined}
          onClick={pending ? undefined : () => startTransition(() => selectStoreAction(store.id))}
        >
          <span className="min-w-0 flex-1 truncate">{store.name}</span>
          <Icon name="chevron-right" size={16} className="shrink-0 text-text-faint" />
        </Row>
      ))}
    </div>
  );
}
