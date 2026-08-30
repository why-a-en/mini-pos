"use client";

import { createContext, useContext, useId, useMemo, type ReactNode } from "react";
import { Field as FieldRoot, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field-parts";
import { cn } from "@/lib/utils";

/** Field hands the control below it a generated id so the label can point at
 *  it with a real `htmlFor`, and its own `required` so the asterisk and the
 *  browser's validation can never disagree. Input and Textarea pick both up
 *  automatically; a control that doesn't (a button group) takes the `group`
 *  branch instead.
 *
 *  Without the id, the label and its input were only *visually* adjacent —
 *  tapping the label didn't focus the input, and assistive tech read the
 *  input as unnamed. `required` had the matching split: it was two separate
 *  props on two elements, and call sites reliably set one without the other,
 *  so a field could show an asterisk and still submit empty (customers, the
 *  order wizard) or block submission with nothing on screen saying it would
 *  (the modifier form on a product page). */
const FieldControlContext = createContext<{ id?: string; required?: boolean }>({});

/** Used by Input/Textarea to adopt the id their Field generated, unless the
 *  caller passed an explicit one. */
export function useFieldControlId(explicitId?: string) {
  const inherited = useContext(FieldControlContext).id;
  return explicitId ?? inherited;
}

/** Same, for `required` — an explicit prop on the control still wins, so a
 *  control can opt out of a required Field (or into an unlabelled one). */
export function useFieldRequired(explicitRequired?: boolean) {
  const inherited = useContext(FieldControlContext).required;
  return explicitRequired ?? inherited;
}

/** Stable identity so the `group` branch doesn't hand every render a fresh
 *  object and re-render the controls that read this context. */
const EMPTY_CONTROL = {};

/** Label + hint + error wrapper. Labels are mono micro-caps; that pairing is
 *  the system's signature.
 *
 *  Set `group` when the children are toggle buttons rather than a form
 *  control (OptionChips, QtyDial). A `<label htmlFor>` would either dangle
 *  against a non-existent id or, worse, hijack clicks into whichever button
 *  happens to be first — so those render as a labelled `role="group"`, which
 *  is the correct ARIA for a set of related controls.
 *
 *  `required` is the whole story for a field: it draws the asterisk, names
 *  the field as required to assistive tech, and reaches the control itself
 *  through the context above. Don't also set `required` on the Input. */
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
  const control = useMemo(() => ({ id: controlId, required }), [controlId, required]);

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

      <FieldControlContext.Provider value={group ? EMPTY_CONTROL : control}>
        {children}
      </FieldControlContext.Provider>

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
