"use client";

import * as React from "react";
import { DayPicker, getDefaultClassNames, type DayButton } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";

/** Month grid, on this system's tokens.
 *
 *  Rewritten wholesale from shadcn's stock calendar, which is built for the
 *  default palette: every one of its classes (`bg-primary`, `bg-popover`,
 *  `ring-ring`, `text-muted-foreground`, `border-input`) names a token this
 *  project doesn't define, and it drives day cells through `Button` with
 *  `size="icon"` — a size our Button doesn't have.
 *
 *  Selection follows the same DENSITY rule as the status ramp rather than a
 *  hue: the two endpoints of a range take the heaviest fill (accent), the
 *  days between take the light wash, and today is marked by a line rather
 *  than a fill so it stays legible underneath a selection. */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const d = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      // 44px keeps every day on the tap-target floor this system sets
      // (--tap-min); at 390px wide, seven of them still fit inside the gutters.
      className={cn("group/calendar w-full [--cell-size:44px]", className)}
      classNames={{
        root: cn("w-full", d.root),
        months: cn("relative flex w-full flex-col", d.months),
        month: cn("flex w-full flex-col gap-3", d.month),

        nav: cn("absolute inset-x-0 top-0 flex items-center justify-between", d.nav),
        button_previous: cn(
          "inline-flex size-9 cursor-pointer items-center justify-center rounded-sm border border-transparent bg-transparent text-text-body outline-none",
          "transition-[background,scale] duration-fast ease-standard hover:bg-surface-hover active:scale-95 focus-visible:shadow-[var(--focus-ring)]",
          "aria-disabled:pointer-events-none aria-disabled:opacity-40",
          d.button_previous,
        ),
        button_next: cn(
          "inline-flex size-9 cursor-pointer items-center justify-center rounded-sm border border-transparent bg-transparent text-text-body outline-none",
          "transition-[background,scale] duration-fast ease-standard hover:bg-surface-hover active:scale-95 focus-visible:shadow-[var(--focus-ring)]",
          "aria-disabled:pointer-events-none aria-disabled:opacity-40",
          d.button_next,
        ),
        month_caption: cn("flex h-9 items-center justify-center", d.month_caption),
        caption_label: cn("font-ui text-title text-text-strong select-none", d.caption_label),

        month_grid: cn("w-full border-collapse", d.month_grid),
        weekdays: cn("flex w-full", d.weekdays),
        weekday: cn("flex-1 font-mono text-label tracking-label uppercase text-text-faint select-none", d.weekday),
        week: cn("mt-1 flex w-full", d.week),

        day: cn("group/day relative flex-1 p-0 text-center select-none", d.day),
        // The range band is drawn on the cell, so it runs edge to edge with
        // no gaps between days; the endpoints round only their outer corner.
        range_start: cn("rounded-l-xs bg-accent-wash", d.range_start),
        range_middle: cn("rounded-none bg-accent-wash", d.range_middle),
        range_end: cn("rounded-r-xs bg-accent-wash", d.range_end),
        today: cn(d.today),
        outside: cn("text-text-faint opacity-50", d.outside),
        disabled: cn("opacity-40", d.disabled),
        hidden: cn("invisible", d.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...rest }) => <div data-slot="calendar" ref={rootRef} className={cn(className)} {...rest} />,
        Chevron: ({ className, orientation, ...rest }) => (
          <Icon
            name={orientation === "left" ? "chevron-left" : orientation === "right" ? "chevron-right" : "chevron-down"}
            size={16}
            className={className}
            {...rest}
          />
        ),
        DayButton: CalendarDayButton,
        ...props.components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({ className, day, modifiers, ...props }: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  const isEndpoint = modifiers.range_start || modifiers.range_end || (modifiers.selected && !modifiers.range_middle);

  return (
    <button
      ref={ref}
      type="button"
      data-day={day.date.toLocaleDateString()}
      data-today={modifiers.today || undefined}
      data-endpoint={isEndpoint || undefined}
      data-middle={modifiers.range_middle || undefined}
      className={cn(
        "flex aspect-square w-full cursor-pointer items-center justify-center rounded-xs border border-transparent bg-transparent",
        "font-ui text-small text-text-body outline-none [font-variant-numeric:tabular-nums]",
        "transition-[background,color,box-shadow,scale] duration-fast ease-standard",
        "hover:bg-surface-hover active:scale-90 focus-visible:shadow-[var(--focus-ring)]",
        // Today is a drawn edge, not a fill — so it survives being selected.
        "data-[today=true]:shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
        // The band lives on the cell; the day inside it just takes the ink.
        "data-[middle=true]:text-text-strong data-[middle=true]:hover:bg-transparent",
        // Endpoints are the heaviest thing in the grid.
        "data-[endpoint=true]:bg-accent data-[endpoint=true]:font-semibold data-[endpoint=true]:text-accent-ink",
        "data-[endpoint=true]:shadow-none data-[endpoint=true]:hover:bg-accent",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
