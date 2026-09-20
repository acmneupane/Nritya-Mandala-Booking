// Maps an attendance record's raw status (+ reason, which is what distinguishes a
// late cancellation from a plain missed class) to the label and theme color used
// wherever attendance history is shown — the parent portal and the admin student
// details view both need this exact same interpretation, so it lives here once.
export function attendanceStatusInfo(h, T) {
  const lateCancel = h.status === "missed" && !!h.reason;
  const label = h.status === "attended" ? "Attended" : h.status === "skipped" ? "Marked absent" : lateCancel ? "Late cancellation" : "Missed";
  const color = h.status === "attended" ? T.sage : h.status === "skipped" ? T.gold : T.terracotta;
  return { label, color, lateCancel };
}

// Whether an attendance record represents the student (or their parent) having
// pre-marked a class as one they'll miss — as opposed to a plain admin-recorded
// miss with no reason. Used to find dates already "dealt with" so they don't get
// re-offered as a date to mark absent, or treated as if nothing's been decided yet.
export function isSelfMarkedAbsence(h) {
  return h.status === "skipped" || (h.status === "missed" && !!h.reason);
}

// Whether half or fewer of a class occurrence's booked students are actually
// expected to show up — i.e. enough have been marked skipped/missed that the
// remaining headcount drops to half the roster or below. Flagged on the
// Calendar and the admin Home tab so staff notice a sparsely-attended session
// before it happens, not after. A class with nobody booked isn't "at risk" —
// there's no session to worry about turnout for.
export function isLowAttendanceRisk(bookedCount, absentCount) {
  if (bookedCount <= 0) return false;
  return bookedCount - absentCount <= bookedCount / 2;
}
