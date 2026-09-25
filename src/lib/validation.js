// Shared form-validation behaviour for the public forms (enrolment, renewal,
// admin-built Forms): every problem is shown at once — the field gets a red
// border and a short note, the page scrolls to the first one, and a single
// message box sits above Submit. See components/Validation.jsx for the pieces.
//
// A form's validate() returns { fieldKey: "What's wrong" } in page order; each
// field is wrapped in <FieldWrap id={fieldKey}> (element id "field-<fieldKey>").
import { T } from "./theme";

export const INVALID_BORDER = `2px solid ${T.terracotta}`;
export const INVALID_BG = `${T.terracotta}08`;

export function problemsMessage(problems) {
  const messages = Object.values(problems);
  if (messages.length === 0) return "";
  return messages.length === 1 ? messages[0] : `Please fix the ${messages.length} highlighted fields above.`;
}

export function scrollToFirstProblem(problems) {
  const first = Object.keys(problems)[0];
  if (first) document.getElementById(`field-${first}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export const SECURITY_CHECK_PENDING = "Just a moment — the security check is still loading. Please try again in a few seconds.";
