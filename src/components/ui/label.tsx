"use client";

import * as React from "react";
import { Label as LabelPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/** Labels in this system are mono micro-caps (see Field, which is where
 *  almost every one comes from) — that pairing is the system's signature, so
 *  it's the default here rather than shadcn's `text-sm font-medium`. */
function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "inline-flex select-none items-center gap-1 font-mono text-label tracking-label uppercase text-text-muted",
        "group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
