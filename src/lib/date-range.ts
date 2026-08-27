/**
 * The date window shared by the Orders log and the Supplier's Purchase
 * Queue, so both offer the same choices and the same URL contract rather
 * than each inventing one.
 *
 * Two shapes, deliberately kept distinct rather than collapsed into one:
 *
 *   ?range=today|7d|30d      a ROLLING preset — a bookmarked "today" still
 *                            means today next week.
 *   ?from=YYYY-MM-DD&to=…    an EXPLICIT window picked on the calendar —
 *                            a shared link keeps the dates it was sent with.
 *
 * Collapsing presets into from/to would freeze them at the moment they were
 * chosen, which is the wrong answer for "show me today's orders"; keeping
 * only presets can't express "the 3rd to the 9th". `from`/`to` wins when
 * both somehow appear.
 *
 * Preset windows anchor to the start of the local day, not to "N × 24h ago":
 * seven days means seven calendar days including today, not a cursor that
 * drops this morning's orders as the afternoon wears on. Server-local time,
 * same caveat as home/page.tsx's "today" — there's no per-organization
 * timezone column on the schema yet.
 */
export const DATE_RANGES = ["all", "today", "7d", "30d"] as const;
export type DateRange = (typeof DATE_RANGES)[number];

export const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

/** A resolved window, ready for both the query and the trigger label. */
export interface DateWindow {
  /** Which preset is active, or "all" when a custom from/to is in play. */
  range: DateRange;
  /** Inclusive lower bound (start of day), or null for no lower bound. */
  from: Date | null;
  /** Inclusive upper bound (end of day), or null for no upper bound. */
  to: Date | null;
  /** True when from/to came from the calendar rather than a preset. */
  custom: boolean;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Parses `YYYY-MM-DD` in LOCAL time. `new Date("2026-08-27")` parses as UTC
 *  and lands on the previous day for anyone behind it — the classic
 *  off-by-one that makes a date picker drop the first day of the range. */
export function parseISODay(value: string | undefined | null): Date | null {
  if (!value || !ISO_DAY.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Formats a Date back to `YYYY-MM-DD` in LOCAL time, for the same reason. */
export function toISODay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function parseRange(value: string | undefined | null): DateRange {
  return DATE_RANGES.includes(value as DateRange) ? (value as DateRange) : "all";
}

/** Narrows untrusted search params into a window both pages can query with. */
export function resolveDateWindow(
  params: { range?: string; from?: string; to?: string },
  now: Date = new Date(),
): DateWindow {
  const from = parseISODay(params.from);
  const to = parseISODay(params.to);

  // An explicit calendar selection wins over any preset still in the URL.
  if (from || to) {
    const lo = from ?? to!;
    const hi = to ?? from!;
    // Tolerate a reversed pair rather than returning nothing.
    const [a, b] = lo <= hi ? [lo, hi] : [hi, lo];
    return { range: "all", from: startOfDay(a), to: endOfDay(b), custom: true };
  }

  const range = parseRange(params.range);
  if (range === "all") return { range, from: null, to: null, custom: false };

  const start = startOfDay(now);
  if (range === "7d") start.setDate(start.getDate() - 6);
  if (range === "30d") start.setDate(start.getDate() - 29);
  return { range, from: start, to: null, custom: false };
}

const MONTH_DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

/** What the picker's trigger reads. Kept short — it sits in a filter row on
 *  a 390px screen, not in a report header. */
export function dateWindowLabel(w: DateWindow): string {
  if (w.custom && w.from && w.to) {
    const sameDay = toISODay(w.from) === toISODay(w.to);
    if (sameDay) return w.from.toLocaleDateString("en-GB", MONTH_DAY);
    return `${w.from.toLocaleDateString("en-GB", MONTH_DAY)} – ${w.to.toLocaleDateString("en-GB", MONTH_DAY)}`;
  }
  return DATE_RANGE_OPTIONS.find((o) => o.value === w.range)?.label ?? "All";
}

/** Phrasing for empty states — "No orders in the last 7 days." */
export function dateWindowSentence(w: DateWindow): string {
  if (w.custom) return `in ${dateWindowLabel(w)}`;
  switch (w.range) {
    case "today":
      return "today";
    case "7d":
      return "in the last 7 days";
    case "30d":
      return "in the last 30 days";
    default:
      return "";
  }
}
