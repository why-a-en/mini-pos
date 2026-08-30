import type { MouseEventHandler, ReactNode } from "react";
import { Thumb } from "@/components/ui/thumb";
import { Icon } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Row } from "@/components/ui/row";
import { cn } from "@/lib/utils";

export function ProductRow({
  name,
  meta,
  image,
  modifiers = [],
  archived,
  sourceUrl,
  href,
  onClick,
  right,
  className,
}: {
  name: string;
  meta?: string;
  image?: string | null;
  modifiers?: string[];
  archived?: boolean;
  sourceUrl?: string | null;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  right?: ReactNode;
  className?: string;
}) {
  const interactive = Boolean(href || onClick);

  return (
    <Row
      href={href}
      onClick={onClick}
      className={cn("min-h-[68px]", archived && "opacity-55", className)}
    >
      <Thumb src={image} size={48} label="product" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-ui text-body-strong text-text-strong">
          {name}
        </span>
        <span className="mt-[3px] flex items-center gap-2">
          {meta ? (
            <span className="font-ui text-small text-text-muted">{meta}</span>
          ) : null}
          {modifiers.length ? (
            <span className="truncate font-ui text-small text-text-faint">
              {modifiers.join(" · ")}
            </span>
          ) : null}
          {sourceUrl ? (
            <Icon name="link" size={12} color="var(--color-accent-quiet)" />
          ) : null}
          {archived ? <Badge tone="quiet">Archived</Badge> : null}
        </span>
      </span>
      {right ??
        (interactive ? (
          <Icon
            name="chevron-right"
            size={16}
            color="var(--color-text-faint)"
          />
        ) : null)}
    </Row>
  );
}
