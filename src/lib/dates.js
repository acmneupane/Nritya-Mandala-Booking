// The studio (and every class it runs) is in Sydney, so "today" and every
// displayed timestamp must resolve to Sydney's calendar/wall clock — never
// whatever timezone the viewer's device or the server happens to be set to
// (this app has been seen running under UTC). Using the device's own local
// timezone here previously caused things like a reminder sent yesterday,
// Sydney time, to be reported as sent "today".
const SYDNEY_TZ = "Australia/Sydney";

// Formats a Date/instant as YYYY-MM-DD in Sydney's timezone. Kept under its
// original name since "today" and every date comparison in the app already
// goes through this function — never use date.toISOString().slice(0,10)
// instead, since that converts to UTC first.
export function localDateStr(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SYDNEY_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// "2026-09-24" -> "Sep 24" — short enough to sit inline next to a class's day/time
// in a picker option or badge (e.g. "Starts Sep 24").
export function formatShortDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// An instant (ISO timestamp, or anything `new Date()` accepts) as a human-
// readable Sydney date/time — for showing exactly when something happened (an
// email sent, a request received) regardless of the viewer's own device timezone.
export function formatSydneyDateTime(input) {
  return new Date(input).toLocaleString(undefined, { timeZone: SYDNEY_TZ, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

// Same as above but date-only (no time-of-day).
export function formatSydneyDate(input) {
  return new Date(input).toLocaleDateString(undefined, { timeZone: SYDNEY_TZ, month: "short", day: "numeric", year: "numeric" });
}

// ISO timestamp -> "today" / "yesterday" / "3 days ago", based on Sydney's
// calendar day for both the event and now — not a rolling 24-hour window, which
// would call something sent 20 hours ago "today" even if a Sydney midnight had
// already passed since.
export function relativeDaysAgo(isoDate) {
  const eventDateStr = localDateStr(new Date(isoDate));
  const todayStr = localDateStr(new Date());
  const days = Math.round((new Date(todayStr) - new Date(eventDateStr)) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days > 1) return `${days} days ago`;
  // isoDate is in the future — every existing caller passes a past event
  // (sent_at/created_at), but a "due since" reference date can be a booking's
  // future start_date, and collapsing that to "today" would misreport it as
  // already due.
  if (days === -1) return "tomorrow";
  return `in ${-days} days`;
}
