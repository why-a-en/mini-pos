"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

type Theme = "dark" | "light";

/** Flips [data-theme] on <html> and persists the choice to localStorage, read
 *  back by the blocking inline script in layout.tsx's <head> (so a returning
 *  visitor who chose light doesn't flash back to the dark default on load).
 *  Dark is the product default; light is the opt-in. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    // One-time read of the real client truth after mount: the server always
    // renders the "dark" default (it has no access to localStorage), and the
    // blocking script in layout.tsx's <head> already corrected the *page*
    // theme before paint if needed — this just brings the toggle's own label
    // in sync with that, without risking a hydration mismatch by reading
    // `document` during the initial render itself.
    const current = document.documentElement.getAttribute("data-theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  function apply(t: Theme) {
    if (t === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem("theme", t);
    } catch {
      // Private browsing / storage blocked — theme still applies for this load.
    }
    setTheme(t);
  }

  return (
    <button
      type="button"
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => apply(theme === "dark" ? "light" : "dark")}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border border-line-hairline bg-surface-raised px-2.5 font-mono text-label tracking-label uppercase text-text-body cursor-pointer outline-none transition-transform duration-instant ease-standard active:scale-95 focus-visible:shadow-[var(--focus-ring)]",
        className,
      )}
    >
      <Icon name={theme === "dark" ? "moon-star" : "sun"} size={13} />
      {theme}
    </button>
  );
}
