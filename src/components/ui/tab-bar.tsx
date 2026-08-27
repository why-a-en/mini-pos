"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
import { cn } from "@/lib/utils";

export interface TabItem {
  href: string;
  label: string;
  icon: IconName;
  count?: number;
}

/** Bottom navigation. Items differ by role — the split is UX, not permissions,
 *  see src/app/(dashboard)/layout.tsx's NAV_BY_ROLE.
 *
 *  Each tab is a real route: active state comes from the current pathname
 *  and selecting one is real navigation via Link, not client state — which
 *  also means a tab is a working link with no JS. */
export function TabBar({ items, className }: { items: TabItem[]; className?: string }) {
  const pathname = usePathname();
  return (
    <nav
      className={cn("sticky bottom-0 z-20 grid border-t border-line-hairline bg-surface-card", className)}
      style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)`, height: "var(--bar-bottom-h)" }}
    >
      {items.map((it) => {
        const on = pathname === it.href || pathname.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn("ds-nav-link relative flex flex-col items-center justify-center gap-1", on ? "text-accent-text" : "text-text-faint")}
          >
            {on ? <span className="absolute inset-x-[28%] top-0 h-0.5 bg-accent" /> : null}
            <span className="relative flex">
              <Icon name={it.icon} size={20} strokeWidth={on ? 2.25 : 1.75} />
              {it.count ? (
                <span className="absolute -top-1.5 -right-2.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-accent px-1 font-mono text-[8px] text-accent-ink">
                  {it.count}
                </span>
              ) : null}
            </span>
            <span className="font-mono text-[9px] tracking-[0.06em] uppercase">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
