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

// ISO timestamp -> "today" / "yesterday" / "3 days ago" — for showing how long ago
// something happened (a request was received, a reminder was sent, a package ran out).
export function relativeDaysAgo(isoDate) {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
