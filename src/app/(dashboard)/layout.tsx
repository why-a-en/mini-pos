import type { ReactNode } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "./actions";

// Session check happens here (a DB hit), not in middleware — see
// src/middleware.ts and docs/TECH_STACK.md's architecture notes for why.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/orders">Orders</Link>
          <Link href="/products">Products</Link>
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
