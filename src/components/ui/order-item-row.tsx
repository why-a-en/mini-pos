import type { MouseEventHandler } from "react";
import { Thumb } from "@/components/ui/thumb";
import { Badge, type OrderItemStatus } from "@/components/ui/badge";
import { Row } from "@/components/ui/row";

export function OrderItemRow({
  product,
  image,
  selection = [],
  qty = 1,
  status = "Pending",
  customer,
  href,
  onClick,
  className,
}: {
  product: string;
  image?: string | null;
  selection?: string[];
  qty?: number;
  status?: OrderItemStatus;
  customer?: string;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
}) {
  return (
    <Row href={href} onClick={onClick} className={className}>
      <Thumb src={image} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-ui text-body-strong text-text-strong">{product}</span>
        <span className="mt-0.5 block truncate font-ui text-small text-text-muted">
          {selection.join(" · ")}
          {selection.length ? "  ·  " : ""}
          <span className="[font-variant-numeric:tabular-nums]">×{qty}</span>
          {customer ? <span className="text-text-faint">{"  ·  " + customer}</span> : null}
        </span>
      </span>
      <Badge status={status} size="sm" />
    </Row>
  );
}
