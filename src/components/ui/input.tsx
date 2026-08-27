"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Icon, type IconName } from "@/components/icon";
import { useFieldControlId } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { fieldShellWrapper, fieldShellInner } from "@/components/ui/field-shell";

/** Single-line text input, with optional leading icon and trailing unit.
 *
 *  That icon/suffix arrangement is exactly what the registry's InputGroup is
 *  for, so it's built on that rather than a hand-rolled flex wrapper: the
 *  addons get `cursor-text` and click-through to the control, and the group
 *  keeps focus and invalid state on the element that owns the corners (the
 *  bare `<input>` has no radius of its own, so a ring drawn on it would poke
 *  out of the rounded field).
 *
 *  InputGroup's own palette and 9px height are replaced by this system's
 *  field shell — see field-shell.ts, which is also what Textarea and
 *  SearchField render, so all three are one treatment. */
function Input({
  icon,
  suffix,
  invalid,
  disabled,
  className,
  id,
  ...props
}: React.ComponentProps<"input"> & { icon?: IconName; suffix?: string; invalid?: boolean }) {
  const controlId = useFieldControlId(id);
  return (
    <InputGroup
      data-disabled={disabled || undefined}
      className={cn(fieldShellWrapper, "h-(--control-h-md) rounded-sm shadow-none", className)}
    >
      {icon ? (
        <InputGroupAddon align="inline-start" className="pl-3 text-text-faint">
          <Icon name={icon} size={16} />
        </InputGroupAddon>
      ) : null}
      <InputGroupInput
        id={controlId}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(fieldShellInner, icon ? "pr-3 pl-0" : "px-3")}
        {...props}
      />
      {suffix ? (
        <InputGroupAddon align="inline-end" className="pr-3 font-ui text-small text-text-faint">
          {suffix}
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}

export { Input };
