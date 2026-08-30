"use client";

import { Icon } from "@/components/icon";
import { Figure } from "@/components/ui/figure";
import { cn } from "@/lib/utils";

/** Quantity control — two open circles rather than a boxed stepper. Decrease
 *  is a quiet outline (removing is neutral), Increase is filled solid in
 *  accent (adding is the affirmative direction, so it gets the one filled
 *  shape) — the same asymmetry Button uses between secondary and primary.
 *  The count between them reuses Figure, the rolling-digit readout StatTile
 *  uses, so bumping the quantity is *witnessed* rather than silently swapped.
 *
 *  Figure exposes the real value to assistive tech itself; the live region
 *  here is what makes a change *announce* rather than merely be readable. */
export function QtyDial({
  value = 1,
  onChange,
  min = 1,
  max = 999,
  className,
}: {
  value?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  const set = (n: number) => onChange?.(Math.min(max, Math.max(min, n)));
  const dot = cn(
    "flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full outline-none",
    "transition-transform duration-instant ease-standard active:scale-90",
    "focus-visible:shadow-[var(--focus-ring)]",
    "disabled:cursor-not-allowed disabled:opacity-40",
  );

  return (
    <div className={cn("inline-flex items-center gap-4", className)}>
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={value <= min}
        onClick={() => set(value - 1)}
        className={cn(dot, "border border-line-strong bg-transparent text-text-body")}
      >
        <Icon name="minus" size={14} />
      </button>

      <span aria-live="polite" aria-atomic="true" className="min-w-[22px] text-center font-ui text-title text-text-strong">
        <Figure value={value} />
      </span>

      <button
        type="button"
        aria-label="Increase quantity"
        disabled={value >= max}
        onClick={() => set(value + 1)}
        className={cn(dot, "border border-transparent bg-accent text-accent-ink")}
      >
        <Icon name="plus" size={14} />
      </button>
    </div>
  );
}
