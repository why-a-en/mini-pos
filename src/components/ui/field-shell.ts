/**
 * The one visual definition of an input surface — used by Input, Textarea,
 * SearchField and the file picker in image-upload-field, so all four are
 * literally the same treatment rather than four near-copies that drift.
 *
 * They previously disagreed three ways: two used `has-[input:focus]` on a
 * wrapper, one used `focus:` on the element; paddings and disabled handling
 * differed; and the focus state was a bare 1px border flipping straight from
 * `--line-hairline` to `--line-focus`. In dark that is 0.272 → 0.965
 * lightness in a single step, with nothing else changing — it reads as a
 * snap, not a transition, however long you make it.
 *
 * The progression now has somewhere to travel:
 *
 *   rest   hairline border, sunken fill
 *   hover  border lifts to --line-strong (an invitation, not a state)
 *   focus  border reaches --line-focus AND a soft halo opens behind it
 *
 * The halo is `--ring-soft`, the same token Button's press ring uses, so
 * focus and press feel like one family. It's what gives the change body:
 * a line brightening alone is abrupt; a line brightening while a 3px glow
 * grows underneath eases.
 */

/** Everything shared by every input surface. */
const base = [
  "w-full border bg-surface-sunken font-ui text-body text-text-strong",
  "transition-[border-color,box-shadow,background-color] duration-fast ease-standard",
  "placeholder:text-text-faint",
  "disabled:cursor-not-allowed disabled:bg-surface-raised disabled:opacity-55",
].join(" ");

/** Border/ring progression for a control that *is* the focusable element
 *  (Textarea, the bare file input) — `:focus` sits directly on it. */
export const fieldShellSelf = [
  base,
  "border-line-hairline outline-none",
  "enabled:hover:border-line-strong",
  "focus:border-line-focus focus:shadow-[0_0_0_3px_var(--color-ring-soft)]",
  "aria-invalid:border-danger aria-invalid:focus:border-danger",
].join(" ");

/** Same progression for a control whose focusable `<input>` is *inside* a
 *  wrapper that owns the corners (Input, SearchField). The wrapper has to
 *  carry the state — the bare input underneath has no radius of its own, so
 *  a ring drawn on it would be a rectangle poking out of a rounded field. */
export const fieldShellWrapper = [
  base,
  "flex items-center gap-2",
  "border-line-hairline",
  "hover:not-has-[input:disabled]:border-line-strong",
  "has-[input:focus]:border-line-focus has-[input:focus]:shadow-[0_0_0_3px_var(--color-ring-soft)]",
  "has-[input[aria-invalid='true']]:border-danger",
].join(" ");

/** The bare `<input>` inside a wrapper: no border, no ring, no outline —
 *  every one of those belongs to the wrapper above. */
export const fieldShellInner =
  "h-full min-w-0 flex-1 border-none bg-transparent font-ui text-body text-inherit shadow-none outline-none placeholder:text-text-faint disabled:cursor-not-allowed";
