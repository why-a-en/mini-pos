import type { AppRole } from "@/lib/auth";

// Presentation-only — see docs/PRD.md §6.5. No data changes; this just
// controls which timezone timestamps render in for a given role. A fixed
// role→timezone mapping, not a per-user setting, per that decision.
const ROLE_TIMEZONES: Record<AppRole, string> = {
  supplier: "Asia/Bangkok", // Thailand time (ICT, UTC+7)
  support_agent: "Asia/Yangon", // Myanmar time (MMT, UTC+6:30)
};

export function timezoneForRole(role: AppRole): string {
  return ROLE_TIMEZONES[role];
}

export function formatInRoleTimezone(
  date: Date,
  role: AppRole,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: timezoneForRole(role) }).format(
    date,
  );
}
