"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Toggle as TogglePrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/** Base for anything with an on/off visual state — Toggle itself, and every
 *  ToggleGroupItem (SegmentedControl's segments, OptionChips' chips).
 *
 *  Restyled off shadcn's defaults onto this system's tokens: `on` is the
 *  accent fill with accent ink, not a tinted `accent`/`accent-foreground`
 *  pair, because the system is monochrome — selection reads as the heaviest
 *  fill in the row, never as a hue. */
const toggleVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-sm font-ui text-small-strong whitespace-nowrap outline-none transition-[background,color,box-shadow,scale] duration-fast ease-standard active:scale-[0.97] focus-visible:shadow-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent text-text-muted hover:bg-surface-hover data-[state=on]:bg-accent data-[state=on]:text-accent-ink",
        outline:
          "border border-line-strong bg-transparent text-text-body hover:bg-surface-hover data-[state=on]:border-transparent data-[state=on]:bg-accent data-[state=on]:text-accent-ink",
      },
      size: {
        sm: "h-8 min-w-8 px-2.5",
        md: "h-(--control-h-md) min-w-(--control-h-md) px-3",
        lg: "h-(--control-h-lg) min-w-(--control-h-lg) px-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return <TogglePrimitive.Root data-slot="toggle" className={cn(toggleVariants({ variant, size, className }))} {...props} />;
}

export { Toggle, toggleVariants };
