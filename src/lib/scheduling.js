// Class scheduling: the one place that works out which dates a weekly class
// actually runs on (next class, upcoming classes, classes in a date range,
// classes on a given day). Everything else calls these rather than re-deriving
// weekdays or looping over dates itself. Unit tests: scheduling.test.js.
//
// Dates are YYYY-MM-DD strings for the studio's (Sydney) calendar day. All
// date maths here works on those strings directly, so the viewer's device
// timezone never shifts a class onto the wrong day.

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ---- Date-string helpers ---------------------------------------------------

function parts(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return [y, m, d];
}

// "2026-09-26" + 3 -> "2026-09-29" (month/year roll-over handled).
export function addDaysToDateStr(dateStr, n) {
  const [y, m, d] = parts(dateStr);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// "2026-09-26" -> "Saturday"
export function weekdayOfDateStr(dateStr) {
  const [y, m, d] = parts(dateStr);
  return WEEKDAYS[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7];
}

// A Date for showing a date string to people (weekday / month names). Midday
// local time, so no timezone offset can tip it onto the neighbouring day.
export function dateFromDateStr(dateStr) {
  const [y, m, d] = parts(dateStr);
  return new Date(y, m - 1, d, 12);
}

// Current wall-clock time in Sydney, "HH:MM".
function sydneyTimeNow(now = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Australia/Sydney", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
}

// ---- Which dates a class runs on -----------------------------------------------

// Whether a recurring class is within its active term on a given date. Null
// start/end means open-ended in that direction.
export function isClassActiveOn(cls, dateStr) {
  if (cls.start_date && dateStr < cls.start_date) return false;
  if (cls.end_date && dateStr > cls.end_date) return false;
  return true;
}

// Whether the class is scheduled on this date: right weekday and within its
// term. (Doesn't look at skipped dates — see isClassSkippedOn.)
export function classRunsOn(cls, dateStr) {
  return cls.day === weekdayOfDateStr(dateStr) && isClassActiveOn(cls, dateStr);
}

// Whether the studio cancelled this class on this date. skips: class_skips rows
// ({ class_id, date }).
export function isClassSkippedOn(cls, dateStr, skips = []) {
  return skips.some((s) => s.class_id === cls.id && s.date === dateStr);
}

// THE core function: the dates a class actually runs on, in order, starting at
// `from` (inclusive) — scheduled weekday, within its term, not cancelled by
// the studio, and not in excludeDates (e.g. dates a student said they'll
// miss). Stops at `to` (inclusive), after `count` dates, or after
// `lookaheadDays` days, whichever comes first.
export function classOccurrences(cls, { from, to = null, count = Infinity, lookaheadDays = 366, skips = [], excludeDates = null }) {
  if (!WEEKDAYS.includes(cls.day)) return [];
  const results = [];
  for (let i = 0; i < lookaheadDays && results.length < count; i++) {
    const dateStr = addDaysToDateStr(from, i);
    if (to && dateStr > to) break;
    if (!classRunsOn(cls, dateStr)) continue;
    if (isClassSkippedOn(cls, dateStr, skips)) continue;
    if (excludeDates && excludeDates.has(dateStr)) continue;
    results.push(dateStr);
  }
  return results;
}

// ---- Convenience wrappers (all built on classOccurrences) ------------------------

// Up to `count` upcoming occurrences from today: { date, dateStr }. Today only
// counts if the class hasn't finished yet (Sydney time). excludeDates skips
// dates the student already marked absent, so "next class" is the next one
// they're still expected at. `now` is for tests.
export function upcomingOccurrencesOf(cls, skips, localDateStrFn, { count = 8, lookaheadDays = 180, excludeDates, now = new Date() } = {}) {
  const todayStr = localDateStrFn(now);
  const cutoff = cls.end_time || cls.time;
  const finishedToday = !!cutoff && cutoff < sydneyTimeNow(now);
  const dates = classOccurrences(cls, {
    from: finishedToday ? addDaysToDateStr(todayStr, 1) : todayStr,
    count,
    lookaheadDays: finishedToday ? lookaheadDays - 1 : lookaheadDays,
    skips,
    excludeDates,
  });
  return dates.map((dateStr) => ({ date: dateFromDateStr(dateStr), dateStr }));
}

// The next real occurrence from today onward, { date, dateStr } or null.
export function nextOccurrenceOf(cls, skips, localDateStrFn, lookaheadDays = 60, excludeDates, now = new Date()) {
  return upcomingOccurrencesOf(cls, skips, localDateStrFn, { count: 1, lookaheadDays, excludeDates, now })[0] || null;
}

// The next date after `dateStr` (not including it) the class runs — e.g. a
// student's next class after the one being viewed. dateStr or null.
export function nextClassDateAfter(cls, dateStr, { skips = [], excludeDates = null, lookaheadDays = 120 } = {}) {
  return classOccurrences(cls, { from: addDaysToDateStr(dateStr, 1), count: 1, lookaheadDays, skips, excludeDates })[0] || null;
}

// How many times a class ran in a date range (inclusive) — finance reporting
// (e.g. per-class rent). `localDateStrFn` is unused, kept for existing callers.
export function occurrencesInRange(cls, skips, localDateStrFn, startDateStr, endDateStr) {
  if (endDateStr < startDateStr) return 0;
  return classOccurrences(cls, { from: startDateStr, to: endDateStr, lookaheadDays: 100000, skips }).length;
}

// The classes scheduled on a date (weekday + term), sorted by start time.
// Cancelled dates are still included unless `skips` is given.
export function classesOnDate(classes, dateStr, skips = null) {
  return classes
    .filter((c) => classRunsOn(c, dateStr) && !(skips && isClassSkippedOn(c, dateStr, skips)))
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}

// ---- Display helpers --------------------------------------------------------------

// "10:00" + "11:00" -> "10:00 – 11:00"; falls back to just the start time if no end set.
export function formatTimeRange(start, end) {
  if (!start) return "";
  return end ? `${start} – ${end}` : start;
}

// Sorts classes by actual weekday order (Monday..Sunday), then by time within the
// same day. Plain string sort on the day name alphabetizes it instead (Friday,
// Monday, Saturday, Thursday, Tuesday, Wednesday...) which is wrong for a schedule.
export function compareClassSchedule(a, b) {
  const dayDiff = WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day);
  if (dayDiff !== 0) return dayDiff;
  return (a.time || "").localeCompare(b.time || "");
}
