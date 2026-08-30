/**
 * The one visual definition of an input surface — used by Input, Textarea,
 * SearchField and the file picker in image-upload-field, so all four are
 * literally the same treatment rather than four near-copies that drift.
 *
 * They previously disagreed three ways: two used `has-[input:focus]` on a
 * wrapper, one used `focus:` on the element; paddings and disabled handling
 * differed; and the focus state was declared per component.
 *
 * The progression:
 *
 *   rest   hairline border, sunken fill
 *   hover  border lifts to --line-strong (an invitation, not a state)
 *   focus  border reaches --line-focus
 *
 * Focus is that border and nothing else, which is a correction. It used to
 * also open a `0 0 0 3px var(--color-ring-soft)` halo, described here as a
 * glow that gave the change body. It was neither soft nor a glow: a
 * box-shadow with spread and *no blur radius* is a hard-edged solid ring.
 * What actually rendered was a second grey band with its own crisp outer
 * boundary, sitting outside a maximum-contrast white line — so a focused
 * field was four stacked edges (fill, white stroke, grey ring, page) where
 * it should read as one. That stack is what made focus look cheap.
 *
 * A blurred version was tried and rejected: on a monochrome dark surface a
 * translucent white bloom reads as haze on the glass, not as focus. Colour
 * is what lets other systems get away with a wide ring, and this one has
 * none. One crisp edge is the honest answer here.
 *
 * The abruptness the halo was meant to cushion is a transition problem, and
 * `base` below already solves it: border-color eases over --dur-fast on
 * --ease-standard. Nothing needs to grow underneath for that to settle.
 *
 * Keyboard users are not worse off — this is a text field, so browsers match
 * :focus-visible on pointer focus too, meaning a separate louder keyboard
 * treatment could never have been differentiated here anyway.
 */

/** Everything shared by every input surface. */
const base = [
  "w-full border bg-surface-sunken font-ui text-body text-text-strong",
  "transition-[border-color,background-color] duration-fast ease-standard",
  "placeholder:text-text-faint",
  "disabled:cursor-not-allowed disabled:bg-surface-raised disabled:opacity-55",
].join(" ");

/** Border progression for a control that *is* the focusable element
 *  (Textarea, the bare file input) — `:focus` sits directly on it.
 *
 *  `focus-visible:shadow-none` is the other half of removing the ring, and
 *  it is easy to miss: base.css carries a global
 *  `:focus-visible { box-shadow: var(--focus-ring) }`, and a text field
 *  matches :focus-visible on pointer focus too, so a bare <textarea> was
 *  still being painted with the 2px+4px keyboard ring on click — the exact
 *  double edge this set out to remove, arriving from somewhere else. The
 *  wrapper shells never showed it because fieldShellInner already clears
 *  box-shadow on the <input> underneath. Utilities outrank layer(base), so
 *  this wins. */
export const fieldShellSelf = [
  base,
  "border-line-hairline outline-none",
  "enabled:hover:border-line-strong",
  "focus:border-line-focus focus-visible:shadow-none",
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
  "has-[input:focus]:border-line-focus",
  "has-[input[aria-invalid='true']]:border-danger",
].join(" ");

/** The bare `<input>` inside a wrapper: no border, no ring, no outline —
 *  every one of those belongs to the wrapper above. */
export const fieldShellInner =
  "h-full min-w-0 flex-1 border-none bg-transparent font-ui text-body text-inherit shadow-none outline-none placeholder:text-text-faint disabled:cursor-not-allowed";
