"use client";

import type { ChangeEventHandler } from "react";

import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { fieldShellWrapper, fieldShellInner } from "@/components/ui/field-shell";

/** Pill-shaped filter input — a leading search glyph and a trailing clear
 *  button, which is the registry InputGroup's exact shape. Identical border,
 *  focus and disabled behaviour to Input; only the radius differs (see
 *  field-shell.ts). */
function SearchField({
  value,
  onChange,
  placeholder = "Search",
  onClear,
  className,
}: {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  onClear?: () => void;
  className?: string;
}) {
  return (
    <InputGroup data-slot="search-field" className={cn(fieldShellWrapper, "h-(--control-h-md) rounded-full shadow-none", className)}>
      <InputGroupAddon align="inline-start" className="pl-3 text-text-faint">
        <Icon name="search" size={16} />
      </InputGroupAddon>

      <InputGroupInput
        // type="search" gets the right virtual keyboard (a Search key
        // instead of Enter) on the phones this is designed for.
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={onChange}
        className={cn(
          fieldShellInner,
          "pl-0",
          // Safari draws its own clear affordance for type="search"; this
          // field has its own, and two would sit on top of each other.
          "[&::-webkit-search-cancel-button]:appearance-none",
        )}
      />

      {value ? (
        <InputGroupAddon align="inline-end" className="pr-3">
          <button
            type="button"
            aria-label="Clear search"
            onClick={onClear}
            className="flex cursor-pointer rounded-full border-none bg-transparent p-0 text-text-faint outline-none transition-[color,scale] duration-fast ease-standard hover:text-text-body active:scale-90 focus-visible:shadow-[var(--focus-ring)]"
          >
            <Icon name="x" size={16} />
          </button>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}

export { SearchField };
