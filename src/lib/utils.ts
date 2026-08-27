import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** This project's type scale, as declared in `--text-*` in app/globals.css. */
const FONT_SIZES = [
  "display-lg",
  "display-md",
  "display-sm",
  "screen-title",
  "title",
  "body",
  "body-strong",
  "small",
  "small-strong",
  "label",
  "code",
  "metric-xl",
  "metric-lg",
  "metric-md",
] as const;

/** And the tracking scale, from `--tracking-*`. */
const TRACKING = ["display", "screen-title", "label", "metric"] as const;

/**
 * The standard shadcn/ui helper — merges Tailwind classes so later ones win
 * over earlier conflicting ones instead of just concatenating.
 *
 * Extended with this project's own scales, which is load-bearing rather than
 * cosmetic. tailwind-merge resolves conflicts from a built-in table of class
 * groups; it has no idea `text-label` is a font size here, so it filed it
 * under *colour* and let the next `text-*` win. Any component that set a size
 * and a colour through one `cn()` call — `cn("text-label", "text-text-muted")`
 * — therefore lost its size silently and inherited whatever the parent used.
 * Badge rendered its 10px mono micro-label at 15px body size for exactly this
 * reason. Declaring the scales here fixes every such pairing at once.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...FONT_SIZES] }],
      tracking: [{ tracking: [...TRACKING] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
