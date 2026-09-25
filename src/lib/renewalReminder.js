// Renewal reminder email: which situation it's about and every placeholder
// value. Used by the admin app's preview (PackageReminderModal); the
// send-package-reminder-email and renewal-reminders-run edge functions have
// the same logic server-side, so the preview matches what's actually sent.
//
// Situations (each has its own subject line in email_templates.subject_variants):
// - running_low: some classes left, but at/below the "coming due" number
// - used_up:     a package on file with no classes left
// - no_package:  no package on file at all (e.g. a reactivated student)
export const REMINDER_SITUATIONS = [
  { key: "running_low", label: "Running low" },
  { key: "used_up", label: "Used up" },
  { key: "no_package", label: "No package" },
];

export function reminderContext(studentName, studentCode, packageSize, classesUsed, renewLink) {
  const size = Number(packageSize ?? 0);
  const used = Number(classesUsed ?? 0);
  const remaining = Math.max(size - used, 0);
  const situation = size <= 0 ? "no_package" : remaining <= 0 ? "used_up" : "running_low";
  const firstName = String(studentName || "").trim().split(/\s+/)[0] || studentName;
  const remainingText = `${remaining} class${remaining === 1 ? "" : "es"}`;
  const statusText = situation === "no_package"
    ? "doesn't have an active package yet"
    : situation === "used_up"
      ? "has now been fully used"
      : `has only ${remainingText} remaining`;
  const packageSummary = situation === "no_package"
    ? `${studentName} doesn't have an active class package at the moment.`
    : situation === "used_up"
      ? `${studentName}'s current class package (${size} classes) has now been fully used.`
      : `${studentName}'s current class package (${size} classes) has only ${remainingText} remaining.`;
  return {
    situation,
    vars: {
      student_name: studentName,
      student_first_name: firstName,
      student_code: studentCode || "",
      package_size: String(size),
      classes_used: String(used),
      remaining: String(remaining),
      remaining_text: remainingText,
      status_text: statusText,
      package_summary: packageSummary,
      renew_link: renewLink ? `<a href="${renewLink}">${renewLink}</a>` : "",
    },
  };
}

// The situation's own subject line, or the template's general one if unset.
export function reminderSubjectTemplate(template, situation) {
  const variant = template?.subject_variants?.[situation];
  return typeof variant === "string" && variant.trim() ? variant : template?.subject || "";
}
