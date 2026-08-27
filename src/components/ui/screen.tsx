"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import { ScrollBar } from "@/components/ui/scroll-area";

/** Layout shell for a full app screen. Every screen in the kit is the same three
 *  parts: a fixed head (TopBar, and sometimes a control strip), a body that
 *  scrolls, and an optional foot pinned to the bottom edge (tab bar, action).
 *  Assembling that by hand per screen is how screens drift apart — and how the
 *  page material gets forgotten. Screen owns it:
 *
 *  - the page surface and the theme's grain (halftone on paper, weave on
 *    charcoal), so no screen is ever a flat grey rectangle;
 *  - the scroll region, with a hairline that appears at whichever edge has
 *    content beyond it — the boundary is stated, not implied by a gradient;
 *  - the gutter contract: head and foot get gutters, the body doesn't, because
 *    rows run edge to edge and their own padding is part of the row rhythm. */
export function Screen({ children, grain = true, className }: { children?: ReactNode; grain?: boolean; className?: string }) {
  return (
    <div className={cn("relative isolate flex min-h-0 flex-1 flex-col bg-surface-page text-text-body", grain && "ds-grain-surface", className)}>
      {children}
    </div>
  );
}

/** Fixed strip between the TopBar and the scroll body — segmented controls,
 *  filter bars, a search field. Gutters on the sides, none at the top: the
 *  TopBar's own bottom edge is the spacing. */
export function Toolbar({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={cn("relative shrink-0 px-5 pb-3", className)}>{children}</div>;
}

/** The scrolling region.
 *
 *  Built on Radix ScrollArea, which keeps native momentum scrolling (it
 *  styles the scrollbar rather than reimplementing the scroll) while giving
 *  a consistent, unobtrusive bar across platforms instead of the chunky
 *  default one Windows and Linux draw over the content.
 *
 *  The edge hairlines are ours: a line appears at whichever edge has content
 *  beyond it, so "there is more below" is stated rather than implied by a
 *  fading gradient. That needs the viewport node, which the stock
 *  ScrollArea wrapper doesn't expose — hence composing the primitive here
 *  rather than importing it. */
export function ScrollBody({ children, className }: { children?: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const top = el.scrollTop > 1;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setEdges((p) => (p.top === top && p.bottom === bottom ? p : { top, bottom }));
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <ScrollAreaPrimitive.Root data-slot="scroll-area" className={cn("relative min-h-0 flex-1", className)}>
      {/* overflow-x is a safety net, not the fix — a grid/flex child missing
          min-width: 0 (see the row components and the wizard's Review step
          for the actual class of bug) can still force a descendant wider
          than the screen; this guarantees that never becomes a *page-level*
          horizontal scrollbar. */}
      <ScrollAreaPrimitive.Viewport
        ref={ref}
        onScroll={measure}
        data-slot="scroll-area-viewport"
        className="size-full overflow-x-hidden outline-none [overscroll-behavior:contain]"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-line-strong transition-opacity duration-fast ease-standard"
        style={{ opacity: edges.top ? 1 : 0 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-line-strong transition-opacity duration-fast ease-standard"
        style={{ opacity: edges.bottom ? 1 : 0 }}
      />
    </ScrollAreaPrimitive.Root>
  );
}

/** Bottom-pinned region: a tab bar, or one primary action over the page. Owns
 *  its own top hairline so the action never floats loose against the body. */
export function Foot({ children, divided = true, padded = false, className }: { children?: ReactNode; divided?: boolean; padded?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "relative shrink-0 bg-surface-page",
        divided && "border-t border-line-hairline",
        // The extra 28px at the bottom (only when padded — an unpadded Foot
        // is fully caller-styled) isn't visual rhythm, it's clearance: the
        // dashboard tab bar's Home button floats above the bar itself by
        // rising outside its own box (CenterTabBar's ISLAND_RISE, ~23.5px) —
        // harmless over scrollable content, which just has padding-bottom
        // under it, but Foot is pinned flush against that same tab bar with
        // nothing scrolling away underneath, so its buttons need the same
        // clearance reserved on purpose instead.
        padded && "px-5 pt-3 pb-[calc(var(--space-3)+28px)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
