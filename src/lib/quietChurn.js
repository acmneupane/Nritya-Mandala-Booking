// "Gone quiet": students who are still booked in and still have classes left
// on their package (so it's not a renewal-due situation, which is surfaced
// elsewhere), but haven't attended in QUIET_CHURN_DAYS — worth a staff member
// reaching out rather than waiting for them to run out of classes. Used by the
// Dashboard and the weekly digest email. Unit tests: quietChurn.test.js.

import { addDaysToDateStr } from "./scheduling.js";

export const QUIET_CHURN_DAYS = 14;

function daysBetween(fromStr, toStr) {
  const [fy, fm, fd] = fromStr.split("-").map(Number);
  const [ty, tm, td] = toStr.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

// students: active students ({ id, ... }); enrollments: { student_id,
// start_date }; packageSummaries: student_package_summary rows; attendance:
// { student_id, date, status } going back well past the churn window.
// Returns [{ ...student, remaining, lastAttended, daysSince }], longest-quiet
// first. Students booked for less than the window aren't flagged.
export function findQuietStudents({ students, enrollments, packageSummaries, attendance, todayStr, days = QUIET_CHURN_DAYS }) {
  const cutoffStr = addDaysToDateStr(todayStr, -days);
  const pkgByStudent = Object.fromEntries(packageSummaries.map((p) => [p.student_id, p]));
  const earliestStartByStudent = {};
  enrollments.forEach((e) => {
    const startStr = e.start_date || "0000-01-01"; // no start_date recorded = booked from the start
    if (!(e.student_id in earliestStartByStudent) || startStr < earliestStartByStudent[e.student_id]) {
      earliestStartByStudent[e.student_id] = startStr;
    }
  });
  const lastAttendedByStudent = {};
  attendance.forEach((a) => {
    if (a.status !== "attended" || a.date > todayStr) return;
    if (!lastAttendedByStudent[a.student_id] || a.date > lastAttendedByStudent[a.student_id]) {
      lastAttendedByStudent[a.student_id] = a.date;
    }
  });
  return students
    .filter((s) => s.id in earliestStartByStudent && earliestStartByStudent[s.id] <= cutoffStr)
    .map((s) => {
      const pkg = pkgByStudent[s.id];
      const remaining = pkg ? pkg.classes_total - pkg.classes_used : 0;
      const lastAttended = lastAttendedByStudent[s.id] || null;
      const daysSince = lastAttended ? daysBetween(lastAttended, todayStr) : null;
      return { ...s, remaining, lastAttended, daysSince };
    })
    .filter((s) => s.remaining > 0 && (!s.lastAttended || s.lastAttended <= cutoffStr))
    .sort((a, b) => (a.lastAttended || "").localeCompare(b.lastAttended || ""));
}
