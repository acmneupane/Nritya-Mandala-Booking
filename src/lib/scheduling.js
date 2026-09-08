// Whether a recurring class is within its active term on a given date (YYYY-MM-DD).
// Null start/end means open-ended in that direction. String comparison works fine
// since both are ISO 8601 dates.
export function isClassActiveOn(cls, dateStr) {
  if (cls.start_date && dateStr < cls.start_date) return false;
  if (cls.end_date && dateStr > cls.end_date) return false;
  return true;
}

// "10:00" + "11:00" -> "10:00 – 11:00"; falls back to just the start time if no end set.
export function formatTimeRange(start, end) {
  if (!start) return "";
  return end ? `${start} – ${end}` : start;
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Finds the next real occurrence of a weekly-recurring class from today onward —
// skipping today if the class's end time has already passed, honoring the class's
// active start/end date range, and skipping any date the studio has marked as
// skipped. Returns { date, dateStr } or null if nothing falls within the lookahead.
export function nextOccurrenceOf(cls, skips, localDateStrFn, lookaheadDays = 60) {
  const dayIndex = WEEKDAYS.indexOf(cls.day);
  if (dayIndex === -1) return null;
  const now = new Date();
  const nowTime = now.toTimeString().slice(0, 5);
  for (let i = 0; i < lookaheadDays; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const jsDay = (d.getDay() + 6) % 7;
    if (jsDay !== dayIndex) continue;
    const dateStr = localDateStrFn(d);
    if (!isClassActiveOn(cls, dateStr)) continue;
    if (i === 0) {
      const cutoff = cls.end_time || cls.time;
      if (cutoff && cutoff < nowTime) continue; // already happened today
    }
    if (skips.some((s) => s.class_id === cls.id && s.date === dateStr)) continue;
    return { date: d, dateStr };
  }
  return null;
}
