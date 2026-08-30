"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { useFieldControlId } from "@/components/ui/field";

/** The one multi-select control. It exists because the modifier picker on a
 *  product page was the last raw `<input type="checkbox">` in the app — a
 *  browser-default box that ignored the palette, the 44px touch target and
 *  the press rules, sitting inside a form of kit controls.
 *
 *  Checked state follows Toggle's rule rather than inventing its own: the
 *  system is monochrome, so "on" is the heaviest fill available (accent with
 *  accent ink), not a hue. Rest/hover borders come from the same two tokens
 *  every input surface uses, so an unchecked box reads as the same material
 *  as the field above it.
 *
 *  Radix bubbles a real hidden `<input type="checkbox">` when `name` is set,
 *  so this drops straight into a server-action `<form>` — repeated `name`s
 *  arrive as a multi-value field, exactly as the bare inputs did. */
function Checkbox({ className, id, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  const controlId = useFieldControlId(id);
  return (
    <CheckboxPrimitive.Root
      id={controlId}
      data-slot="checkbox"
      className={cn(
        "peer size-5 shrink-0 cursor-pointer rounded-[5px] border border-line-strong bg-surface-sunken outline-none",
        "transition-[background,border-color,box-shadow,scale] duration-fast ease-standard",
        "hover:border-surface-invert active:scale-90 focus-visible:shadow-[var(--focus-ring)]",
        "data-[state=checked]:border-transparent data-[state=checked]:bg-accent data-[state=checked]:text-accent-ink",
        "aria-invalid:border-danger",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Icon name="check" size={14} strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

/** Checkbox + its text, as one target. The whole row is the label, so the
 *  tap area is the sentence rather than the 20px box — the phone-first
 *  reason this is a component and not two elements at each call site. It
 *  also carries the `active:` feedback the box can't give on its own when
 *  the press lands on the words.
 *
 *  It mints its own id rather than adopting an enclosing Field's: a set of
 *  these is the normal case, and they'd otherwise all answer to the same
 *  one. The wrapping `<label>` is what associates them anyway. */
function CheckboxField({
  className,
  children,
  id,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root> & { children: React.ReactNode }) {
  const ownId = React.useId();
  return (
    <label
      className={cn(
        "inline-flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-sm pr-1 font-ui text-small text-text-body",
        "transition-transform duration-instant ease-standard active:scale-[0.97]",
        "has-[button:disabled]:cursor-not-allowed has-[button:disabled]:opacity-40",
        className,
      )}
    >
      <Checkbox id={id ?? ownId} {...props} />
      {children}
    </label>
  );
}

export { Checkbox, CheckboxField };
