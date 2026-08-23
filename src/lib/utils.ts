import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// The standard shadcn/ui helper — merges Tailwind classes, letting later
// classes win over earlier conflicting ones instead of just concatenating.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
