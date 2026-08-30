"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/** A sunken tray of equal-width segments with the active one inverted to
 *  solid ink — the system's filter control (Parcels' stages, Orders'
 *  draft/placed). Built on Radix ToggleGroup rather than a bare button map,
 *  so arrow keys move between segments the way a real tablist does.
 *
 *  `type="single"` with a always-defined `value` makes this a controlled
 *  radio group: Radix emits "" when the active segment is re-pressed, which
 *  is swallowed here — a filter always has exactly one selection, and
 *  deselecting into an empty state isn't reachable in the UI. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => next && onChange(next as T)}
      className={cn("inline-flex w-full gap-0.5 rounded-sm border border-line-hairline bg-surface-sunken p-[3px]", className)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className="h-8 min-w-0 flex-1 rounded-xs px-3 data-[state=on]:bg-surface-invert data-[state=on]:text-text-invert data-[state=on]:hover:bg-surface-invert"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
