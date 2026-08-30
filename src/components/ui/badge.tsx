import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

export const ORDER_ITEM_STATUSES = ["Pending", "Purchased", "Received", "Packed", "Completed", "Cancelled"] as const;
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number];

/** One chip component, two jobs — previously two near-identical files.
 *
 *  `tone` is a free label ("Draft", "Archived"): pill-shaped, printed as
 *  written. `status` is the Order Item lifecycle: square-cornered and
 *  upper-cased, because its six values are a fixed vocabulary rather than
 *  prose, and separated by DENSITY rather than hue — the chip gets
 *  materially heavier as the order advances, so a row of them reads as
 *  progress with no legend. Cancelled sits off that ramp (it is not "further
 *  along"): it reuses the Purchased fill and is marked by a hatched edge
 *  band instead. The hatch never runs under the label — same-colour stripes
 *  through glyphs dissolve the letterforms. See the status ramp block in
 *  styles/tokens/colors.css.
 *
 *  Both share the mono micro-label, the stretch layout, and the hatch band,
 *  which is what made keeping them apart pure duplication. */
const badgeVariants = cva(
  "inline-flex shrink-0 items-stretch justify-center font-mono tracking-label whitespace-nowrap [font-variant-numeric:tabular-nums]",
  {
    variants: {
      tone: {
        neutral: "bg-surface-raised text-text-muted",
        accent: "bg-accent text-accent-ink",
        quiet: "bg-transparent text-text-muted shadow-[inset_0_0_0_1px_var(--color-line-hairline)]",
        // Monochrome: destructive reads by hatch, not by red.
        danger: "bg-danger-wash text-danger shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
      },
      status: {
        Pending: "bg-status-pending-bg text-status-pending-ink shadow-[inset_0_0_0_1px_var(--color-status-pending-line)]",
        Purchased: "bg-status-purchased-bg text-status-purchased-ink shadow-[inset_0_0_0_1px_var(--color-status-purchased-line)]",
        Received: "bg-status-received-bg text-status-received-ink shadow-[inset_0_0_0_1px_var(--color-status-received-line)]",
        Packed: "bg-status-packed-bg text-status-packed-ink shadow-[inset_0_0_0_1px_var(--color-status-packed-line)]",
        Completed: "bg-status-completed-bg text-status-completed-ink shadow-[inset_0_0_0_1px_var(--color-status-completed-line)]",
        Cancelled: "bg-status-cancelled-bg text-status-cancelled-ink shadow-[inset_0_0_0_1px_var(--color-status-cancelled-line)]",
      },
      size: {
        sm: "h-5 min-w-5 gap-1.5 text-[9px]",
        md: "h-6 min-w-6 gap-2 text-[10px]",
      },
    },
    compoundVariants: [
      // A free label is a pill and prints as written; a lifecycle value is
      // square-cornered and upper-cased.
      { status: undefined, class: "rounded-full text-label" },
      { status: [...ORDER_ITEM_STATUSES], class: "rounded-xs uppercase" },
      // The hatch band trades leading padding on the two hatched variants.
      { tone: "danger", class: "pr-[7px] pl-[3px]" },
      { status: "Cancelled", size: "sm", class: "pl-[3px] pr-2" },
      { status: "Cancelled", size: "md", class: "pl-1 pr-2.5" },
    ],
    defaultVariants: { size: "sm" },
  },
);

function Badge({
  className,
  tone,
  status,
  size,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";
  const hatched = tone === "danger" || status === "Cancelled";
  const resolvedTone = status ? undefined : (tone ?? "neutral");

  return (
    <Comp
      data-slot="badge"
      data-tone={resolvedTone}
      data-status={status ?? undefined}
      className={cn(
        badgeVariants({ tone: resolvedTone, status, size }),
        // Padding for the un-hatched cases, kept out of the variant table so
        // the compound rules above stay readable.
        !hatched && (size === "md" ? "px-2.5" : "px-[7px]"),
        className,
      )}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {hatched ? (
            <span
              aria-hidden="true"
              className={cn(
                "ds-hatch shrink-0 self-stretch",
                status ? "rounded-[calc(var(--radius-xs)-1px)]" : "rounded-full",
                status ? (size === "md" ? "w-[13px]" : "w-2.5") : "w-[9px]",
              )}
            />
          ) : null}
          <span className="inline-flex items-center">{children ?? status}</span>
        </>
      )}
    </Comp>
  );
}

export { Badge, badgeVariants };
