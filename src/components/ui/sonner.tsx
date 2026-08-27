"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

import { Icon } from "@/components/icon";

/** Success-only in this app (see error-dialog.tsx for failures — a toast is
 *  ambient and easy to miss, which is exactly wrong for an error). Sonner
 *  replaces the old per-view `useState` + manual `setTimeout` auto-dismiss
 *  pair with a real stacking/swipe-to-dismiss/aria-live toast, restyled here
 *  to the app's own raised-card look instead of shadcn's default. Mounted
 *  once in the dashboard shell (see (dashboard)/layout.tsx). */
function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      position="bottom-center"
      duration={3200}
      // Clears the bottom tab bar (--bar-bottom-h) plus the raised Home
      // island that floats above it — a toast pinned to the viewport edge
      // lands underneath both and is unreadable on the screens that raise
      // most of them.
      offset={{ bottom: "76px" }}
      mobileOffset={{ bottom: "76px" }}
      icons={{ success: <Icon name="check" size={16} color="var(--color-text-strong)" /> }}
      style={{ "--width": "min(90vw, calc(var(--content-max) - 2 * var(--gutter)))" } as React.CSSProperties}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex items-center gap-2.5 rounded-sm border border-line-strong bg-surface-raised px-3.5 py-3 font-ui text-small text-text-body shadow-dialog",
          title: "flex-1",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
