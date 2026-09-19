// Formats a Date as YYYY-MM-DD using its LOCAL calendar date — never use
// date.toISOString().slice(0,10) for this, since toISOString() converts to UTC
// first. For anyone east of UTC (e.g. Australia, UTC+10/+11), that silently shifts
// the date back by one day for any local time before UTC midnight — which is most
// of the day — causing date-range and "today" checks to be off by one.
export function localDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// "2026-09-24" -> "Sep 24" — short enough to sit inline next to a class's day/time
// in a picker option or badge (e.g. "Starts Sep 24").
export function formatShortDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
