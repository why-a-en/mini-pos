import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

/** A numeric readout whose digits roll to their new value, so a change is
 *  witnessed rather than only reported. In a monochrome system this is how a
 *  figure signals that it is live — nothing else about it can change colour.
 *
 *  Digits animate; separators, currency and units render flat. Respects
 *  prefers-reduced-motion through the .ds-figure rules in tokens/base.css.
 *
 *  Each rolling digit is a stack of all ten numerals clipped to one line box,
 *  so the DOM under a "7" literally reads 0123456789. That's hidden from
 *  assistive tech here, once, with the real value exposed alongside — rather
 *  than left for each of StatTile / PurchaseGroupCard / QtyDial to remember. */
export function Figure({ value, className }: { value: string | number; className?: string }) {
  const text = String(value ?? "");
  const chars = text.split("");

  return (
    <span data-slot="figure" className={cn("inline-flex items-baseline [font-variant-numeric:tabular-nums]", className)}>
      <span aria-hidden="true" className="inline-flex items-baseline">
        {chars.map((ch, i) => {
          if (!/[0-9]/.test(ch)) {
            return <span key={i}>{ch}</span>;
          }
          return (
            <span key={i} className="ds-figure" style={{ "--ds-digit": Number(ch), "--ds-digit-h": "1em" } as CSSProperties}>
              <span>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
