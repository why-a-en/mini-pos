import type { ReactNode } from "react";

// Shared by product/order creation forms. text-base (16px) on the actual
// inputs (set by each caller) matters on mobile — anything smaller triggers
// iOS Safari's auto-zoom on focus, which is exactly the kind of rough edge
// docs/TECH_STACK.md §6 calls out.
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

export const fieldInputClass =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-base focus:border-neutral-500 focus:outline-none";
