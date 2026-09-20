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

// Sorts classes by actual weekday order (Monday..Sunday), then by time within the
// same day. Plain string sort on the day name alphabetizes it instead (Friday,
// Monday, Saturday, Thursday, Tuesday, Wednesday...) which is wrong for a schedule.
export function compareClassSchedule(a, b) {
  const dayDiff = WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day);
  if (dayDiff !== 0) return dayDiff;
  return (a.time || "").localeCompare(b.time || "");
}

// Finds up to `count` upcoming occurrences of a weekly-recurring class — same rules
// as above (active date range, skipped dates, today only counts if not yet finished).
// excludeDates (optional Set of YYYY-MM-DD strings) additionally skips dates the
// student themselves has already marked absent for this class — used so "next
// class" reflects the next one they're actually still expected to attend, not one
// they've already said they'll miss.
export function upcomingOccurrencesOf(cls, skips, localDateStrFn, { count = 8, lookaheadDays = 180, excludeDates } = {}) {
  const dayIndex = WEEKDAYS.indexOf(cls.day);
  if (dayIndex === -1) return [];
  const now = new Date();
  const nowTime = now.toTimeString().slice(0, 5);
  const results = [];
  for (let i = 0; i < lookaheadDays && results.length < count; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const jsDay = (d.getDay() + 6) % 7;
    if (jsDay !== dayIndex) continue;
    const dateStr = localDateStrFn(d);
    if (!isClassActiveOn(cls, dateStr)) continue;
    if (i === 0) {
      const cutoff = cls.end_time || cls.time;
      if (cutoff && cutoff < nowTime) continue;
    }
    if (skips.some((s) => s.class_id === cls.id && s.date === dateStr)) continue;
    if (excludeDates && excludeDates.has(dateStr)) continue;
    results.push({ date: d, dateStr });
  }
  return results;
}

// Finds the next real occurrence of a weekly-recurring class from today onward —
// skipping today if the class's end time has already passed, honoring the class's
// active start/end date range, and skipping any date the studio has marked as
// skipped (plus, if excludeDates is given, any date the student has already
// marked absent). Returns { date, dateStr } or null if nothing falls within the lookahead.
export function nextOccurrenceOf(cls, skips, localDateStrFn, lookaheadDays = 60, excludeDates) {
  return upcomingOccurrencesOf(cls, skips, localDateStrFn, { count: 1, lookaheadDays, excludeDates })[0] || null;
}

// Counts how many times a class actually ran within a given date range (inclusive),
// respecting the class's active term and any dates the studio marked as skipped.
// Unlike upcomingOccurrencesOf (which looks forward from today), this works for any
// past, present, or future range — used for finance reporting (e.g. per-class rent).
export function occurrencesInRange(cls, skips, localDateStrFn, startDateStr, endDateStr) {
  const dayIndex = WEEKDAYS.indexOf(cls.day);
  if (dayIndex === -1) return 0;
  let count = 0;
  const start = new Date(startDateStr + "T00:00:00");
  const end = new Date(endDateStr + "T00:00:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const jsDay = (d.getDay() + 6) % 7;
    if (jsDay !== dayIndex) continue;
    const dateStr = localDateStrFn(d);
    if (!isClassActiveOn(cls, dateStr)) continue;
    if (skips.some((s) => s.class_id === cls.id && s.date === dateStr)) continue;
    count++;
  }
  return count;
}
