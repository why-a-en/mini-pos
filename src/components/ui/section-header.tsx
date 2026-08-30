import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Sticky group divider inside a scrolling list — a date, a status, a letter. */
export function SectionHeader({
  children,
  right,
  sticky = true,
  className,
}: {
  children?: ReactNode;
  right?: ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "z-[5] flex items-center justify-between gap-2 bg-surface-page px-5 pt-2.5 pb-1.5 font-mono text-label tracking-label uppercase text-text-faint",
        sticky && "sticky top-0",
        className,
      )}
    >
      <span>{children}</span>
      {right ? <span>{right}</span> : null}
    </div>
  );
}
