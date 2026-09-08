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
