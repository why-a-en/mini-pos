"use client";

// PROTOTYPE ONLY — /prototype UI.md floating variant switcher. Not part of
// the product; hidden outside development and dropped from main once a
// variant wins (see the prototype skill + docs/agents pointer on the
// implementation issue). Shared by every sub-shape-A prototype route.
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export type PrototypeVariant = { key: string; label: string };

export function PrototypeSwitcher({
  variants,
  current,
  paramName = "variant",
}: {
  variants: PrototypeVariant[];
  current: string;
  paramName?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === current),
  );

  const go = (nextIndex: number) => {
    const wrapped = (nextIndex + variants.length) % variants.length;
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, variants[wrapped].key);
    router.replace(`?${params.toString()}`);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isEditable) return;
      if (e.key === "ArrowLeft") go(index - 1);
      if (e.key === "ArrowRight") go(index + 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const active = variants[index];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-fuchsia-400 bg-neutral-900 px-2 py-2 text-white shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
        <button
          type="button"
          aria-label="Previous variant"
          onClick={() => go(index - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg leading-none hover:bg-white/10"
        >
          ←
        </button>
        <span className="min-w-[9rem] text-center text-xs font-medium">
          <span className="rounded bg-fuchsia-500 px-1.5 py-0.5 font-mono">{active.key}</span>{" "}
          {active.label}
        </span>
        <button
          type="button"
          aria-label="Next variant"
          onClick={() => go(index + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg leading-none hover:bg-white/10"
        >
          →
        </button>
      </div>
    </div>
  );
}
