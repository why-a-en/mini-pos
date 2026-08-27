"use client";

import { useState } from "react";
import { useQueryStates } from "nuqs";
import type { DateRange as DayPickerRange } from "react-day-picker";

import { Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import {
  DATE_RANGE_OPTIONS,
  dateWindowLabel,
  resolveDateWindow,
  toISODay,
  type DateRange,
  type DateWindow,
} from "@/lib/date-range";

/** The `?range=` / `?from=&to=` filter shared by the Orders log and the
 *  Purchase Queue: a trigger showing the active window, opening a sheet with
 *  the rolling presets on top and a month grid under them.
 *
 *  Both filters are written together through `useQueryStates` so a preset and
 *  a calendar selection can never both sit in the URL — picking one clears
 *  the other in a single history entry, rather than two updates that race.
 *
 *  `shallow: false`: this is a *server* filter, unlike the search and status
 *  filters beside it. Both lists fetch a capped window of rows, so narrowing
 *  by date on the client would only ever search inside the most recent page —
 *  asking for last month would show whichever slice of last month happened to
 *  fall in the newest 50 rows. The round-trip is the point. */
export function DateRangeFilter({ window: initial }: { window: DateWindow }) {
  const [params, setParams] = useQueryStates(
    {
      range: { defaultValue: "", parse: String, serialize: String },
      from: { defaultValue: "", parse: String, serialize: String },
      to: { defaultValue: "", parse: String, serialize: String },
    },
    { shallow: false, clearOnDefault: true },
  );

  // Server-resolved until nuqs hydrates, then derived from the URL so the
  // trigger label and the sheet always agree with what was actually queried.
  const active = params.range || params.from || params.to
    ? resolveDateWindow({ range: params.range, from: params.from, to: params.to })
    : initial;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DayPickerRange | undefined>();

  /** Seed the calendar from whatever is actually live, so backing out and
   *  reopening doesn't resurrect an abandoned selection. Done here rather
   *  than in an effect keyed on `open`: the sheet has exactly one way in, so
   *  this is a plain event handler, not state that needs syncing. */
  function openSheet() {
    setDraft(active.custom && active.from ? { from: active.from, to: active.to ?? active.from } : undefined);
    setOpen(true);
  }

  function applyPreset(range: DateRange) {
    void setParams({ range: range === "all" ? "" : range, from: "", to: "" });
    setOpen(false);
  }

  function applyDraft() {
    if (!draft?.from) return;
    void setParams({ range: "", from: toISODay(draft.from), to: toISODay(draft.to ?? draft.from) });
    setOpen(false);
  }

  function clearAll() {
    void setParams({ range: "", from: "", to: "" });
    setDraft(undefined);
    setOpen(false);
  }

  const filtering = active.custom || active.range !== "all";

  return (
    <>
      {/* Deliberately narrow: this sits beside the search field on a 390px
          screen, and search is the more frequent tool of the two. Unfiltered
          it collapses to a single icon square, giving search the whole row;
          once a window is active it widens just enough to name it, capped and
          truncated so it can never crowd search out. The full window is
          always readable inside the sheet, and in the aria-label either way. */}
      <button
        type="button"
        onClick={openSheet}
        aria-haspopup="dialog"
        aria-label={filtering ? `Date filter: ${dateWindowLabel(active)}. Change` : "Filter by date"}
        className={cn(
          "flex h-(--control-h-md) shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-sm border bg-surface-sunken outline-none",
          "transition-[background,border-color,box-shadow,scale] duration-fast ease-standard",
          "hover:border-line-strong active:scale-95 focus-visible:shadow-[var(--focus-ring)]",
          filtering ? "max-w-[132px] border-line-strong px-2.5" : "w-(--control-h-md) border-line-hairline",
        )}
      >
        <Icon name="calendar" size={16} color={filtering ? "var(--color-text-strong)" : "var(--color-text-faint)"} />
        {filtering ? <span className="min-w-0 truncate font-ui text-small-strong text-text-strong">{dateWindowLabel(active)}</span> : null}
      </button>

      <Sheet open={open} onOpenChange={(next) => (next ? openSheet() : setOpen(false))}>
        <SheetContent>
          <SheetHeader title="Filter by date" eyebrow="date range" />
          <SheetBody>
            <div className="grid gap-4 pt-1">
              <SegmentedControl
                options={DATE_RANGE_OPTIONS}
                value={active.custom ? "all" : active.range}
                onChange={applyPreset}
              />
              <div className="border-t border-line-hairline pt-3">
                <Calendar
                  mode="range"
                  numberOfMonths={1}
                  selected={draft}
                  onSelect={setDraft}
                  defaultMonth={draft?.from ?? active.from ?? undefined}
                  // Nothing in this app is ordered in the future, so a future
                  // date can only ever return an empty list.
                  disabled={{ after: new Date() }}
                  autoFocus
                />
              </div>
            </div>
          </SheetBody>
          <SheetFooter>
            <div className="grid gap-2">
              <Button full icon="check" disabled={!draft?.from} onClick={applyDraft}>
                {draft?.from ? `Apply ${dateWindowLabel(resolveDateWindow({ from: toISODay(draft.from), to: toISODay(draft.to ?? draft.from) }))}` : "Pick a date range"}
              </Button>
              <Button full variant="secondary" icon="x" disabled={!filtering && !draft?.from} onClick={clearAll}>
                Clear filter
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
