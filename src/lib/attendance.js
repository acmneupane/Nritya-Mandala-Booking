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
