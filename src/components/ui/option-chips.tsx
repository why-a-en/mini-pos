"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/** Modifier Option picker — the product's Colour/Size choices. Single-select
 *  by default, which is how modifier selection works on an Order Item.
 *
 *  Pill chips on the `outline` toggle variant: quiet outline when off, solid
 *  accent fill when on. Wraps, because a product with six colours shouldn't
 *  push a 375px screen sideways. */
export function OptionChips({
  options = [],
  value,
  onChange,
  multi = false,
  className,
}: {
  options?: string[];
  value?: string | string[] | null;
  onChange?: (value: string | string[]) => void;
  multi?: boolean;
  className?: string;
}) {
  const listClass = cn("flex flex-wrap gap-2", className);
  const chipClass = "h-9 rounded-full px-3.5";

  if (multi) {
    const selected = Array.isArray(value) ? value : value != null ? [value] : [];
    return (
      <ToggleGroup type="multiple" variant="outline" value={selected} onValueChange={(next) => onChange?.(next)} className={listClass}>
        {options.map((o) => (
          <ToggleGroupItem key={o} value={o} className={chipClass}>
            {o}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    );
  }

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={typeof value === "string" ? value : ""}
      // Radix emits "" when the active chip is re-pressed. A modifier
      // selection is required to add the item, so re-pressing shouldn't
      // silently clear it back to an un-submittable state.
      onValueChange={(next) => next && onChange?.(next)}
      className={listClass}
    >
      {options.map((o) => (
        <ToggleGroupItem key={o} value={o} className={chipClass}>
          {o}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
