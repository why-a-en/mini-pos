"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { useFieldControlId } from "@/components/ui/field";
import { fieldShellSelf } from "@/components/ui/field-shell";

/** Multi-line input. Shares Input's exact border/focus/disabled treatment
 *  (field-shell.ts) — it used to declare its own, one step out of sync.
 *
 *  `resize-y` is deliberate on a phone-first app: the drag handle is a
 *  desktop affordance, and `field-sizing-content` grows the box to fit what
 *  has actually been typed on browsers that support it, so the handle is a
 *  fallback rather than the mechanism. */
function Textarea({
  className,
  rows = 3,
  invalid,
  id,
  ...props
}: React.ComponentProps<"textarea"> & { invalid?: boolean }) {
  const controlId = useFieldControlId(id);
  return (
    <textarea
      id={controlId}
      data-slot="textarea"
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(fieldShellSelf, "field-sizing-content resize-y rounded-sm px-3 py-2.5", className)}
      {...props}
    />
  );
}

export { Textarea };
