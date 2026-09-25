// Shared helpers for Forms (Admin → Forms, and the public /forms?code= page).
// The database (submit_form_response) re-validates everything; these are for
// building, rendering and reading forms in the browser.
import { APP_ORIGIN } from "./origins";
import { T } from "./theme";

export const QUESTION_TYPES = [
  { key: "short_text", label: "Short answer", hasOptions: false },
  { key: "long_text", label: "Long answer", hasOptions: false },
  { key: "single_choice", label: "Single choice", hasOptions: true },
  { key: "multi_choice", label: "Multiple choice", hasOptions: true },
  { key: "dropdown", label: "Dropdown", hasOptions: true },
  { key: "yes_no", label: "Yes / No", hasOptions: false },
  { key: "rating", label: "Rating 1–5", hasOptions: false },
  { key: "day_time", label: "Preferred days & times", hasOptions: true },
];

export const questionTypeLabel = (type) => QUESTION_TYPES.find((t) => t.key === type)?.label || type;
export const typeHasOptions = (type) => !!QUESTION_TYPES.find((t) => t.key === type)?.hasOptions;

export const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

// Short id for a choice option — stays the same when the option is renamed,
// so older answers keep pointing at it.
export function newOptionId() {
  return Math.random().toString(36).slice(2, 8);
}

export function defaultOptions(type) {
  if (type === "day_time") {
    return [
      { id: newOptionId(), label: "Morning" },
      { id: newOptionId(), label: "Afternoon" },
      { id: newOptionId(), label: "Evening" },
    ];
  }
  if (typeHasOptions(type)) return [{ id: newOptionId(), label: "Option 1" }, { id: newOptionId(), label: "Option 2" }];
  return [];
}

export const CONTACT_MODES = [
  { key: "hidden", label: "Hidden" },
  { key: "optional", label: "Optional" },
  { key: "required", label: "Required" },
];

export const contactShown = (form) =>
  form.contact_name_mode !== "hidden" || form.contact_email_mode !== "hidden" || form.contact_phone_mode !== "hidden";

// Sydney date string (YYYY-MM-DD) — the close date is a Sydney calendar day.
function sydneyToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
}

// Same rule as form_effective_status() in the database: a published form past
// its close date counts as unpublished. (Database values stay draft / open /
// closed; admin shows them as Draft / Published / Unpublished.)
export function effectiveStatus(form) {
  if (form.status === "open" && form.closes_on && form.closes_on < sydneyToday()) return "closed";
  return form.status;
}

export const STATUS_INFO = {
  draft: {
    label: "Draft",
    dot: "⚪",
    color: T.inkSoft,
    explain: "Not published yet — the link goes to the homepage. You can still change the code.",
  },
  open: {
    label: "Published",
    dot: "🟢",
    color: T.sage,
    explain: "Live — accepting responses.",
  },
  closed: {
    label: "Unpublished",
    dot: "🟠",
    color: T.terracotta,
    explain: "The link shows “no longer accepting responses”. You can publish it again.",
  },
};

// "Adult Classes 2026" -> "ADULTCLASSES2026" (letters and digits, max 20).
export function codeFromTitle(title) {
  const base = String(title || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
  return base.length >= 3 ? base : (base + "FORM").slice(0, 20);
}

export function cleanCode(code) {
  return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24);
}

// Where a share link is being posted. The key goes on the link as &src=key and
// is saved with each response (and in the CSV export).
export const SHARE_CHANNELS = [
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "notice", label: "Nritya Mandala notice" },
  { key: "email", label: "Email" },
  { key: "flyer", label: "Flyer / poster (QR code)" },
];

export function sourceLabel(key) {
  if (!key) return "Direct link";
  return SHARE_CHANNELS.find((c) => c.key === key)?.label || key;
}

export function formLink(code, source) {
  const base = `${APP_ORIGIN}/forms?code=${encodeURIComponent(code)}`;
  return source ? `${base}&src=${encodeURIComponent(source)}` : base;
}

export function isAnswered(value) {
  return !(value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0));
}

// A response's answer as readable text (responses list, CSV). Mirrors
// answerText() in the notify-form-response edge function.
export function answerText(question, value) {
  if (!isAnswered(value)) return "";
  const options = Array.isArray(question.options) ? question.options : [];
  const optionLabel = (id) => options.find((o) => o.id === id)?.label ?? id;
  switch (question.type) {
    case "single_choice":
    case "dropdown":
      return optionLabel(String(value));
    case "multi_choice":
      return value.map(optionLabel).join(", ");
    case "yes_no":
      return value === "yes" ? "Yes" : "No";
    case "rating":
      return `${value} / 5`;
    case "day_time":
      return value
        .map((v) => {
          const [day, slot] = String(v).split(":");
          return `${DAYS.find((d) => d.key === day)?.label ?? day} ${optionLabel(slot)}`;
        })
        .join(", ");
    default:
      return String(value);
  }
}

export const RESPONSE_STATUSES = [
  { key: "new", label: "New", color: T.terracotta },
  { key: "contacted", label: "Contacted", color: T.gold },
  { key: "not_interested", label: "Not interested", color: T.inkSoft },
  { key: "enrolled", label: "Enrolled", color: T.sage },
];

export const responseStatusInfo = (key) => RESPONSE_STATUSES.find((s) => s.key === key) || RESPONSE_STATUSES[0];

// The message from a failed submit-form call (validation errors come back as
// a non-2xx response, which supabase-js reports as an error object).
export async function functionErrorMessage(error, data, fallback) {
  if (data?.error) return data.error;
  try {
    const body = await error?.context?.json?.();
    if (body?.error) return body.error;
  } catch {
    // Not JSON — use the fallback.
  }
  return fallback;
}
