"use client";

import { createContext, useContext, useId, type ReactNode } from "react";
import { Field as FieldRoot, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field-parts";
import { cn } from "@/lib/utils";

/** Field hands the control below it a generated id so the label can point at
 *  it with a real `htmlFor`. Input and Textarea pick it up automatically; a
 *  control that doesn't (a button group) takes the `group` branch instead.
 *
 *  Without this the label and its input were only *visually* adjacent —
 *  tapping the label didn't focus the input, and assistive tech read the
 *  input as unnamed. */
const FieldControlContext = createContext<string | undefined>(undefined);

/** Used by Input/Textarea to adopt the id their Field generated, unless the
 *  caller passed an explicit one. */
export function useFieldControlId(explicitId?: string) {
  const inherited = useContext(FieldControlContext);
  return explicitId ?? inherited;
}

/** Label + hint + error wrapper. Labels are mono micro-caps; that pairing is
 *  the system's signature.
 *
 *  Set `group` when the children are toggle buttons rather than a form
 *  control (OptionChips, QtyDial). A `<label htmlFor>` would either dangle
 *  against a non-existent id or, worse, hijack clicks into whichever button
 *  happens to be first — so those render as a labelled `role="group"`, which
 *  is the correct ARIA for a set of related controls. */
export function Field({
  label,
  hint,
  error,
  required,
  group = false,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  group?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const controlId = useId();
  const labelId = `${controlId}-label`;
  const messageId = `${controlId}-message`;

  const labelContent = (
    <>
      {label}
      {required ? (
        <span aria-hidden="true" className="text-text-strong">
          *
        </span>
      ) : null}
      {required ? <span className="sr-only">(required)</span> : null}
    </>
  );

  return (
    <FieldRoot
      className={cn("gap-1.5", className)}
      {...(group && label ? { "aria-labelledby": labelId } : {})}
    >
      {label ? (
        group ? (
          <span id={labelId} className="inline-flex items-center gap-1 font-mono text-label tracking-label uppercase text-text-muted">
            {labelContent}
          </span>
        ) : (
          <FieldLabel htmlFor={controlId}>{labelContent}</FieldLabel>
        )
      ) : null}

      <FieldControlContext.Provider value={group ? undefined : controlId}>{children}</FieldControlContext.Provider>

      {error ? (
        <FieldError id={messageId} className="font-ui text-small text-danger">
          {error}
        </FieldError>
      ) : hint ? (
        <FieldDescription id={messageId} className="font-ui text-small text-text-faint">
          {hint}
        </FieldDescription>
      ) : null}
    </FieldRoot>
  );
}
