// Student birthdays for staff: the Dashboard's "Birthdays" section, the
// Calendar day view banner/roster badge, and the check-in message. Dates are
// calendar days (YYYY-MM-DD, local studio date), no time zones involved.
// A 29 Feb birthday is celebrated on 28 Feb in non-leap years.

function isLeap(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// The birthday's date in a given year, as YYYY-MM-DD.
function birthdayInYear(dob, year) {
  let [, m, d] = dob.split("-").map(Number);
  if (m === 2 && d === 29 && !isLeap(year)) d = 28;
  return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysBetween(fromStr, toStr) {
  const [fy, fm, fd] = fromStr.split("-").map(Number);
  const [ty, tm, td] = toStr.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

export function isBirthdayOn(dob, dateStr) {
  if (!dob || !dateStr) return false;
  return birthdayInYear(dob, Number(dateStr.slice(0, 4))) === dateStr;
}

// The next birthday on or after fromStr: { dateStr, daysUntil, age } — age is
// the age they turn on that day.
export function nextBirthday(dob, fromStr) {
  if (!dob) return null;
  const year = Number(fromStr.slice(0, 4));
  let dateStr = birthdayInYear(dob, year);
  if (dateStr < fromStr) dateStr = birthdayInYear(dob, year + 1);
  return {
    dateStr,
    daysUntil: daysBetween(fromStr, dateStr),
    age: Number(dateStr.slice(0, 4)) - Number(dob.slice(0, 4)),
  };
}

// Students with a birthday from todayStr to todayStr + withinDays, soonest
// first: [{ ...student, dateStr, daysUntil, age }].
export function upcomingBirthdays(students, todayStr, withinDays = 14) {
  return students
    .map((s) => ({ s, next: nextBirthday(s.dob, todayStr) }))
    .filter(({ next }) => next && next.daysUntil <= withinDays)
    .map(({ s, next }) => ({ ...s, ...next }))
    .sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name));
}

// "26 Sep"
export function formatBirthdayDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
