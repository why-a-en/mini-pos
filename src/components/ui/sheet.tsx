"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/icon-button";

/** Bottom sheet — the system's only modal surface. Dialogs on a phone are
 *  sheets; there is no centred alert box (see error-dialog.tsx, which is a
 *  sheet too). Built on Radix Dialog: real focus trap, scroll lock, portal
 *  and ESC handling, where the hand-rolled predecessor only closed on an
 *  explicit backdrop click. */
function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-60 bg-overlay-scrim",
        "data-[state=open]:animate-scrim-in data-[state=closed]:animate-scrim-out",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  /** Radix warns unless a dialog is described or explicitly opts out. Every
   *  sheet here is titled and self-evident from its own body, so the opt-out
   *  is the honest default — pass a string to point at real describing text
   *  instead of inventing a hidden paragraph nobody maintains. */
  describedBy,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { describedBy?: string }) {
  return (
    <SheetPrimitive.Portal data-slot="sheet-portal">
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        aria-describedby={describedBy}
        className={cn(
          // The sheet is pinned to the viewport, but the app shell is a
          // centred, max-width column (see (dashboard)/layout.tsx) — matching
          // that here keeps the sheet from spanning edge to edge on a tablet
          // while the UI it belongs to sits in a narrow column.
          "fixed inset-x-0 bottom-0 z-60 mx-auto flex max-h-[88%] w-full max-w-(--content-max) flex-col",
          "rounded-t-lg border-t border-line-hairline bg-surface-card shadow-sheet outline-none",
          "data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out",
          className,
        )}
        {...props}
      >
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

/** Drag handle + eyebrow/title row + close (✕). Every sheet in the app wants
 *  exactly this, so it's one piece rather than reassembled per call site.
 *  `dismissible={false}` drops the handle and the ✕ — for a sheet that may
 *  only be closed from its own footer (see ErrorDialog). */
function SheetHeader({
  title,
  eyebrow,
  dismissible = true,
  className,
}: {
  title?: React.ReactNode;
  /** Micro-label above the title — e.g. a step indicator for a multi-step
   *  form inside one sheet. */
  eyebrow?: string;
  dismissible?: boolean;
  className?: string;
}) {
  return (
    <div data-slot="sheet-header" className={cn("shrink-0", className)}>
      {dismissible ? (
        <div className="flex justify-center pt-2" aria-hidden="true">
          <span className="h-1 w-9 rounded-full bg-line-strong" />
        </div>
      ) : null}
      <div className={cn("flex items-center gap-2 px-5 pb-2", dismissible ? "pt-2.5" : "pt-4")}>
        <div className="min-w-0 flex-1">
          {eyebrow ? <div className="mb-0.5 font-mono text-label tracking-label uppercase text-text-faint">{eyebrow}</div> : null}
          <SheetPrimitive.Title asChild>
            <div className="font-display text-display-sm tracking-display text-text-strong">{title}</div>
          </SheetPrimitive.Title>
        </div>
        {dismissible ? (
          <SheetClose asChild>
            <IconButton icon="x" label="Close" size="icon-sm" className="-mr-1.5" />
          </SheetClose>
        ) : null}
      </div>
    </div>
  );
}

/** The scrolling middle. `min-h-0` is what actually lets it scroll inside the
 *  sheet's own max-height instead of pushing the footer off-screen. */
function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-body" className={cn("min-h-0 flex-1 overflow-y-auto px-5 pb-8", className)} {...props} />;
}

/** Pinned action area. The bottom padding clears the tab bar's raised Home
 *  island the same way Screen's Foot does. */
function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("shrink-0 border-t border-line-hairline bg-surface-card px-5 pt-3 pb-10", className)}
      {...props}
    />
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetOverlay, SheetContent, SheetHeader, SheetBody, SheetFooter };
