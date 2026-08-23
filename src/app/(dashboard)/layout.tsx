import type { ReactNode } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "./actions";

// Role-based show/hide (PRD §4): each role's nav only shows what's
// relevant to their job. No backend permission matrix behind this — see
// docs/PRD.md §3 "Roles & permissions" for why that's a deliberate
// simplicity call, not an oversight.
const NAV_BY_ROLE = {
  customer_service: [
    { href: "/orders", label: "Orders" },
    { href: "/packing-queue", label: "Packing Queue" },
    { href: "/products", label: "Products" },
  ],
  supplier: [
    { href: "/purchase-queue", label: "Purchase Queue" },
    { href: "/orders", label: "Order History" },
  ],
} as const;

// Session check happens here (a DB hit), not in proxy.ts — see
// src/proxy.ts and docs/TECH_STACK.md's architecture notes for why.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const nav = NAV_BY_ROLE[user.role];

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
        <nav className="flex items-center gap-4 text-sm font-medium">
          {nav.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <span className="hidden sm:inline">{user.name}</span>
          <form action={logoutAction}>
            <button type="submit" className="underline">
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
