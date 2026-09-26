// The weekly digest email for staff: what's coming up next week, birthdays,
// what needs attention, a recap of the past week, forms and unread messages.
// No money and no parent data beyond names.
//
// This file is the single source for the digest: the `weekly-digest` edge
// function deploys a copy of it (together with scheduling.js, birthdays.js,
// quietChurn.js, attendance.js and dates.js), and it's unit tested here
// (weeklyDigest.test.js). Keep it free of browser/React/Supabase-client code —
// loadDigestData() takes a plain `get(path)` that fetches a PostgREST path.
//
// Windows, for a digest sent on `todayStr` (normally a Friday evening):
//   week ahead = tomorrow .. today + 7   (Sat .. next Fri)
//   past week  = today - 6 .. today      (last Sat .. today)

import { addDaysToDateStr, classesOnDate, classOccurrences, isClassSkippedOn, formatTimeRange } from "./scheduling.js";
import { nextBirthday, formatBirthdayDay } from "./birthdays.js";
import { findQuietStudents } from "./quietChurn.js";
import { isLowAttendanceRisk } from "./attendance.js";
import { localDateStr } from "./dates.js";

export const DIGEST_SECTIONS = [
  { key: "week_ahead", label: "Week ahead", description: "Classes each day with booked numbers and who's away, cancelled classes, and announcements showing that week." },
  { key: "birthdays", label: "Birthdays", description: "Birthdays in the coming week (and belated ones from the past week), with the class to wish them at." },
  { key: "attention", label: "Needs attention", description: "Pending enrolment and renewal requests, students due for renewal or out of classes, packages not marked as paid, and students who've gone quiet." },
  { key: "last_week", label: "Last week recap", description: "Attendance numbers and rate, new students, enrolments and renewals approved, automatic reminders sent." },
  { key: "forms", label: "Forms", description: "Forms created, and responses per form." },
  { key: "messages", label: "Unread messages", description: "Messages from the website's \"Get in touch\" form that haven't been marked as read yet (whenever they came in)." },
];

export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const DEFAULT_DIGEST_DAY = "Friday";
export const DEFAULT_DIGEST_HOUR = 20;

// A missing key means on — sections added later start switched on.
export function isSectionOn(sections, key) {
  return !sections || sections[key] !== false;
}

export function digestWindows(todayStr) {
  return {
    aheadFrom: addDaysToDateStr(todayStr, 1),
    aheadTo: addDaysToDateStr(todayStr, 7),
    pastFrom: addDaysToDateStr(todayStr, -6),
    pastTo: todayStr,
  };
}

// "8pm" / "12pm" / "12am"
export function formatHour(hour) {
  const h = Number(hour);
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${suffix}`;
}

// Whether a scheduled run at `now` should send: the configured Sydney weekday
// and hour, and not already sent today (the cron fires hourly).
export function isDigestDue({ now = new Date(), day = DEFAULT_DIGEST_DAY, hour = DEFAULT_DIGEST_HOUR, lastSentOn = null }) {
  const parts = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", weekday: "long", hour: "numeric", hourCycle: "h23" }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const nowHour = Number(parts.find((p) => p.type === "hour")?.value);
  const todayStr = localDateStr(now);
  return weekday === day && nowHour === Number(hour) && lastSentOn !== todayStr;
}

// ---- Loading ----------------------------------------------------------------

// `get(path)` -> parsed JSON array for a PostgREST path (service role, so RLS
// doesn't hide anything). Timestamps are fetched from a day early and filtered
// to Sydney dates below.
export async function loadDigestData(get, todayStr) {
  const { aheadTo, pastFrom } = digestWindows(todayStr);
  const historyFrom = addDaysToDateStr(todayStr, -120);
  const sinceIso = `${addDaysToDateStr(pastFrom, -1)}T00:00:00Z`;
  const [
    classes, enrollments, skips, attendance, students, packageSummaries, notices,
    pendingEnrolments, pendingRenewals, unpaidPackages, reviewedEnrolments, reviewedRenewals,
    autoReminders, forms, formResponses, contactMessages, settingsRows,
  ] = await Promise.all([
    get("classes?select=id,label,day,time,end_time,start_date,end_date"),
    get("enrollments?select=student_id,class_id,start_date"),
    get(`class_skips?select=class_id,date,reason&date=gte.${pastFrom}&date=lte.${aheadTo}`),
    get(`attendance?select=student_id,class_id,date,status,reason&date=gte.${historyFrom}&date=lte.${aheadTo}`),
    get("students?select=id,name,code,dob,created_at&archived=eq.false"),
    get("student_package_summary?select=student_id,classes_total,classes_used"),
    get(`studio_notices?select=message,start_date,end_date,show_on_public,show_on_parent&start_date=lte.${aheadTo}&end_date=gte.${todayStr}&order=start_date`),
    get("enrollment_requests?select=id,reference,guardian_name,created_at,is_transfer,enrollment_request_students(student_name)&status=eq.pending&order=created_at"),
    get("package_renewal_requests?select=id,student_id,created_at,tier_name_snapshot,students(name,code)&status=eq.pending&order=created_at"),
    get("packages?select=id,purchase_date,tier_name,classes_total,students(name,code,archived)&payment_confirmed=eq.false&order=purchase_date"),
    get(`enrollment_requests?select=id,reviewed_at&status=eq.approved&reviewed_at=gte.${sinceIso}`),
    get(`package_renewal_requests?select=id,reviewed_at&status=eq.approved&reviewed_at=gte.${sinceIso}`),
    get(`email_log?select=sent_at,student_id&email_type=eq.renewal_reminder_auto&success=eq.true&sent_at=gte.${sinceIso}`),
    get("forms?select=id,code,title,status,created_at,closes_on&order=created_at"),
    get("form_responses?select=form_id,status,submitted_at"),
    get("contact_messages?select=name,email,message,created_at&read=eq.false&order=created_at.desc&limit=100"),
    get("admin_settings?id=eq.1&select=due_threshold"),
  ]);
  return {
    classes, enrollments, skips, attendance, students, packageSummaries, notices,
    pendingEnrolments, pendingRenewals, unpaidPackages, reviewedEnrolments, reviewedRenewals,
    autoReminders, forms, formResponses, contactMessages,
    dueThreshold: settingsRows?.[0]?.due_threshold ?? 2,
  };
}

// ---- Working things out (pure) ---------------------------------------------

const inWindow = (dateStr, from, to) => dateStr >= from && dateStr <= to;
const sydneyDateOf = (iso) => localDateStr(new Date(iso));

function bookedOn(enrollments, classId, dateStr) {
  return enrollments.filter((e) => e.class_id === classId && (!e.start_date || e.start_date <= dateStr));
}

// Classes per day for the week ahead: [{ dateStr, classes: [{ cls, booked,
// away: [names], lowTurnout }], cancelled: [{ cls, reason }] }], days with
// nothing on left out.
export function weekAhead(data, todayStr) {
  const { aheadFrom } = digestWindows(todayStr);
  const namesById = Object.fromEntries(data.students.map((s) => [s.id, s.name]));
  const days = [];
  for (let i = 0; i < 7; i++) {
    const dateStr = addDaysToDateStr(aheadFrom, i);
    const scheduled = classesOnDate(data.classes, dateStr);
    if (scheduled.length === 0) continue;
    const classes = [];
    const cancelled = [];
    scheduled.forEach((cls) => {
      if (isClassSkippedOn(cls, dateStr, data.skips)) {
        const skip = data.skips.find((s) => s.class_id === cls.id && s.date === dateStr);
        cancelled.push({ cls, reason: skip?.reason || "" });
        return;
      }
      const booked = bookedOn(data.enrollments, cls.id, dateStr).length;
      const away = data.attendance
        .filter((a) => a.class_id === cls.id && a.date === dateStr && (a.status === "skipped" || a.status === "missed"))
        .map((a) => namesById[a.student_id] || "Unknown");
      classes.push({ cls, booked, away, lowTurnout: isLowAttendanceRisk(booked, away.length) });
    });
    days.push({ dateStr, classes, cancelled });
  }
  return days;
}

// The class a student could be wished at for a birthday: in class on the day,
// else their last class before it (from `fromStr`), else their first class
// after it. { when: "on_day" | "early" | "belated", dateStr, cls } or null.
export function wishingClass(studentClasses, birthdayStr, fromStr, { skips = [], excludeDates = null } = {}) {
  const runs = (from, to) => studentClasses.flatMap((cls) =>
    classOccurrences(cls, { from, to, skips, excludeDates, lookaheadDays: 60 }).map((dateStr) => ({ dateStr, cls })),
  ).sort((a, b) => a.dateStr.localeCompare(b.dateStr) || (a.cls.time || "").localeCompare(b.cls.time || ""));
  const onDay = birthdayStr >= fromStr ? runs(birthdayStr, birthdayStr)[0] : null;
  if (onDay) return { when: "on_day", ...onDay };
  if (birthdayStr > fromStr) {
    const before = runs(fromStr, addDaysToDateStr(birthdayStr, -1));
    if (before.length) return { when: "early", ...before[before.length - 1] };
  }
  const afterFrom = birthdayStr >= fromStr ? addDaysToDateStr(birthdayStr, 1) : fromStr;
  const after = runs(afterFrom, addDaysToDateStr(afterFrom, 20))[0];
  return after ? { when: "belated", ...after } : null;
}

// { coming: [...], belated: [...] } — each { student, birthday: { dateStr,
// age }, wish } — coming = the week ahead, belated = the past week.
export function digestBirthdays(data, todayStr) {
  const { aheadFrom, pastFrom } = digestWindows(todayStr);
  const classById = Object.fromEntries(data.classes.map((c) => [c.id, c]));
  const classesOf = (studentId) => [...new Set(data.enrollments.filter((e) => e.student_id === studentId).map((e) => e.class_id))]
    .map((id) => classById[id]).filter(Boolean);
  const awayDatesOf = (studentId) => new Set(data.attendance
    .filter((a) => a.student_id === studentId && (a.status === "skipped" || a.status === "missed") && a.date >= aheadFrom)
    .map((a) => a.date));
  const coming = [];
  const belated = [];
  data.students.forEach((s) => {
    if (!s.dob) return;
    const opts = { skips: data.skips, excludeDates: awayDatesOf(s.id) };
    const past = nextBirthday(s.dob, pastFrom);
    if (past.daysUntil <= 6) {
      belated.push({ student: s, birthday: past, wish: wishingClass(classesOf(s.id), past.dateStr, aheadFrom, opts) });
      return;
    }
    const next = nextBirthday(s.dob, aheadFrom);
    if (next.daysUntil <= 6) {
      coming.push({ student: s, birthday: next, wish: wishingClass(classesOf(s.id), next.dateStr, aheadFrom, opts) });
    }
  });
  const byDate = (a, b) => a.birthday.dateStr.localeCompare(b.birthday.dateStr) || a.student.name.localeCompare(b.student.name);
  return { coming: coming.sort(byDate), belated: belated.sort(byDate) };
}

// Everything in "Needs attention".
export function needsAttention(data, todayStr) {
  const pkgByStudent = Object.fromEntries(data.packageSummaries.map((p) => [p.student_id, p]));
  const pendingRenewalFor = new Set(data.pendingRenewals.map((r) => r.student_id));
  const outOfClasses = [];
  const runningLow = [];
  data.students.forEach((s) => {
    const pkg = pkgByStudent[s.id];
    const hasPackage = !!pkg && pkg.classes_total > 0;
    const remaining = hasPackage ? pkg.classes_total - pkg.classes_used : 0;
    if (remaining > data.dueThreshold) return;
    const row = { student: s, remaining, hasPackage, renewalRequested: pendingRenewalFor.has(s.id) };
    (remaining <= 0 ? outOfClasses : runningLow).push(row);
  });
  const byName = (a, b) => a.student.name.localeCompare(b.student.name);
  return {
    pendingEnrolments: data.pendingEnrolments,
    pendingRenewals: data.pendingRenewals,
    outOfClasses: outOfClasses.sort(byName),
    runningLow: runningLow.sort((a, b) => a.remaining - b.remaining || byName(a, b)),
    unpaidPackages: data.unpaidPackages.filter((p) => !p.students?.archived),
    goneQuiet: findQuietStudents({
      students: data.students,
      enrollments: data.enrollments,
      packageSummaries: data.packageSummaries,
      attendance: data.attendance,
      todayStr,
    }),
  };
}

export function lastWeekRecap(data, todayStr) {
  const { pastFrom, pastTo } = digestWindows(todayStr);
  const rows = data.attendance.filter((a) => inWindow(a.date, pastFrom, pastTo));
  const attended = rows.filter((a) => a.status === "attended").length;
  const markedAbsent = rows.filter((a) => a.status === "skipped").length;
  const missed = rows.filter((a) => a.status === "missed").length;
  const marked = attended + markedAbsent + missed;
  let classesHeld = 0;
  data.classes.forEach((cls) => {
    classesHeld += classOccurrences(cls, { from: pastFrom, to: pastTo, skips: data.skips }).length;
  });
  const cancelled = data.skips.filter((s) => inWindow(s.date, pastFrom, pastTo)).length;
  return {
    classesHeld,
    cancelled,
    attended,
    markedAbsent,
    missed,
    rate: marked > 0 ? Math.round((attended / marked) * 100) : null,
    newStudents: data.students.filter((s) => s.created_at && inWindow(sydneyDateOf(s.created_at), pastFrom, pastTo)),
    enrolmentsApproved: data.reviewedEnrolments.filter((r) => inWindow(sydneyDateOf(r.reviewed_at), pastFrom, pastTo)).length,
    renewalsApproved: data.reviewedRenewals.filter((r) => inWindow(sydneyDateOf(r.reviewed_at), pastFrom, pastTo)).length,
    autoReminders: data.autoReminders.filter((r) => inWindow(sydneyDateOf(r.sent_at), pastFrom, pastTo)).length,
  };
}

// { created: [forms created in the past week], perForm: [{ form, thisWeek,
// total, toReview }] } — perForm lists open forms and any form with
// responses this week.
export function formsSummary(data, todayStr) {
  const { pastFrom, pastTo } = digestWindows(todayStr);
  const created = data.forms.filter((f) => f.created_at && inWindow(sydneyDateOf(f.created_at), pastFrom, pastTo));
  const perForm = data.forms.map((form) => {
    const responses = data.formResponses.filter((r) => r.form_id === form.id);
    return {
      form,
      thisWeek: responses.filter((r) => inWindow(sydneyDateOf(r.submitted_at), pastFrom, pastTo)).length,
      total: responses.length,
      toReview: responses.filter((r) => r.status === "new").length,
    };
  }).filter((f) => f.form.status === "open" || f.thisWeek > 0);
  return { created, perForm };
}

// Unread "Get in touch" messages, newest first — not limited to the past week,
// so nothing unread drops out of the digest until someone marks it as read
// (Dashboard). contactMessages is already only the unread ones.
export function unreadMessages(data) {
  return data.contactMessages.filter((m) => !m.read);
}

// ---- Rendering ----------------------------------------------------------------

// The admin app's theme colours (src/lib/theme.js), inlined for email clients.
const C = { ink: "#241B15", soft: "#7A6A5C", line: "#E6D3BE", maroon: "#6E1D17", sage: "#5F7052", gold: "#C58D2E", terracotta: "#B8562F" };

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

// Announcements are stored as rich-text HTML; the digest shows plain text.
export function plainText(html, max = 220) {
  const text = String(html ?? "")
    .replace(/<br\s*\/?>/gi, " ").replace(/<\/(p|div|li|h\d)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const shortDay = (dateStr) => formatBirthdayDay(dateStr);
const h2 = (text) => `<h2 style="font-family:Georgia,serif;font-size:18px;color:${C.maroon};margin:26px 0 8px;padding-bottom:4px;border-bottom:1px solid ${C.line};">${text}</h2>`;
const h3 = (text) => `<h3 style="font-size:14px;color:${C.ink};margin:14px 0 4px;">${text}</h3>`;
const p = (html, color = C.ink) => `<p style="font-size:14px;line-height:1.5;color:${color};margin:4px 0;">${html}</p>`;
const muted = (html) => p(html, C.soft);
const list = (items) => `<ul style="margin:4px 0 8px;padding-left:20px;font-size:14px;line-height:1.55;color:${C.ink};">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const studentLabel = (s) => `${esc(s?.name || "Unknown")}${s?.code ? ` <span style="color:${C.soft};">(${esc(s.code)})</span>` : ""}`;
const classLabel = (cls) => `${esc(cls.label || cls.day)} ${esc(formatTimeRange(cls.time, cls.end_time))}`;

function renderWeekAhead(days, notices) {
  let html = h2("📅 Week ahead");
  if (days.length === 0) html += muted("No classes scheduled next week.");
  days.forEach((day) => {
    html += h3(esc(shortDay(day.dateStr)));
    const items = day.classes.map(({ cls, booked, away, lowTurnout }) => {
      const awayText = away.length ? ` · ${away.length} away (${away.map(esc).join(", ")})` : "";
      const warn = lowTurnout ? ` <strong style="color:${C.terracotta};">⚠ low turnout</strong>` : "";
      return `${classLabel(cls)} — ${plural(booked, "booked", "booked")}${awayText}${warn}`;
    });
    day.cancelled.forEach(({ cls, reason }) => {
      items.push(`<span style="color:${C.soft};text-decoration:line-through;">${classLabel(cls)}</span> <strong style="color:${C.terracotta};">cancelled</strong>${reason ? ` — ${esc(reason)}` : ""}`);
    });
    html += list(items);
  });
  if (notices.length) {
    html += h3("📣 Announcements showing");
    html += list(notices.map((n) => {
      const where = [n.show_on_public && "public website", n.show_on_parent && "parent page"].filter(Boolean).join(" + ") || "not shown anywhere";
      return `${esc(plainText(n.message))} <span style="color:${C.soft};">(${esc(shortDay(n.start_date))} – ${esc(shortDay(n.end_date))}, ${where})</span>`;
    }));
  }
  return html;
}

function wishText(wish) {
  if (!wish) return `<span style="color:${C.soft};">no class booked</span>`;
  const at = `${esc(wish.cls.label || wish.cls.day)} on ${esc(shortDay(wish.dateStr))}`;
  if (wish.when === "on_day") return `🎉 in class on the day — ${at}`;
  if (wish.when === "early") return `wish them at ${at}`;
  return `belated wishes at ${at}`;
}

function renderBirthdays({ coming, belated }) {
  let html = h2("🎂 Birthdays");
  if (!coming.length && !belated.length) return html + muted("No birthdays next week or in the past week.");
  if (coming.length) {
    html += h3("Next week");
    html += list(coming.map(({ student, birthday, wish }) => `<strong>${esc(shortDay(birthday.dateStr))}</strong> — ${esc(student.name)} turns ${birthday.age} · ${wishText(wish)}`));
  }
  if (belated.length) {
    html += h3("Past week (belated)");
    html += list(belated.map(({ student, birthday, wish }) => `<strong>${esc(shortDay(birthday.dateStr))}</strong> — ${esc(student.name)} turned ${birthday.age} · ${wishText(wish)}`));
  }
  return html;
}

function renderAttention(a) {
  let html = h2("🔔 Needs attention");
  const blocks = [];
  if (a.pendingEnrolments.length) {
    blocks.push(h3(`Enrolment requests waiting (${a.pendingEnrolments.length})`) + list(a.pendingEnrolments.map((r) => {
      const kids = (r.enrollment_request_students || []).map((s) => esc(s.student_name)).join(", ");
      return `${esc(r.guardian_name || "Unknown")}${kids ? ` — ${kids}` : ""}${r.is_transfer ? " (transfer)" : ""} <span style="color:${C.soft};">· received ${esc(shortDay(sydneyDateOf(r.created_at)))}${r.reference ? ` · ${esc(r.reference)}` : ""}</span>`;
    })));
  }
  if (a.pendingRenewals.length) {
    blocks.push(h3(`Renewal requests waiting (${a.pendingRenewals.length})`) + list(a.pendingRenewals.map((r) =>
      `${studentLabel(r.students)}${r.tier_name_snapshot ? ` — ${esc(r.tier_name_snapshot)}` : ""} <span style="color:${C.soft};">· received ${esc(shortDay(sydneyDateOf(r.created_at)))}</span>`)));
  }
  const renewalNote = (row) => (row.renewalRequested ? ` <span style="color:${C.sage};">· renewal requested</span>` : "");
  if (a.outOfClasses.length) {
    blocks.push(h3(`Out of classes / no package (${a.outOfClasses.length})`) + list(a.outOfClasses.map((row) =>
      `${studentLabel(row.student)} — ${row.hasPackage ? "package fully used" : "no package on file"}${renewalNote(row)}`)));
  }
  if (a.runningLow.length) {
    blocks.push(h3(`Due for renewal (${a.runningLow.length})`) + list(a.runningLow.map((row) =>
      `${studentLabel(row.student)} — ${plural(row.remaining, "class", "classes")} left${renewalNote(row)}`)));
  }
  if (a.unpaidPackages.length) {
    blocks.push(h3(`Packages not marked as paid (${a.unpaidPackages.length})`) + list(a.unpaidPackages.map((pkg) =>
      `${studentLabel(pkg.students)} — ${esc(pkg.tier_name || plural(pkg.classes_total, "class", "classes"))}${pkg.purchase_date ? ` <span style="color:${C.soft};">· ${esc(shortDay(pkg.purchase_date))}</span>` : ""}`)));
  }
  if (a.goneQuiet.length) {
    blocks.push(h3(`Gone quiet (${a.goneQuiet.length})`) + muted("Still booked in with classes left, but not attending — might be worth a check-in.") + list(a.goneQuiet.map((s) =>
      `${studentLabel(s)} — ${s.lastAttended ? `last attended ${esc(shortDay(s.lastAttended))} (${s.daysSince} days ago)` : "hasn't attended yet"}`)));
  }
  return html + (blocks.length ? blocks.join("") : muted("Nothing needs attention. 🎉"));
}

function renderLastWeek(r) {
  let html = h2("📊 Last week");
  const items = [
    `${plural(r.classesHeld, "class", "classes")} scheduled${r.cancelled ? `, ${r.cancelled} cancelled` : ""}`,
    `Attendance: <strong>${r.attended}</strong> attended · ${r.markedAbsent} marked absent · ${r.missed} missed${r.rate !== null ? ` — <strong>${r.rate}%</strong> attendance rate` : ""}`,
    `New students: ${r.newStudents.length ? r.newStudents.map((s) => esc(s.name)).join(", ") : "none"}`,
    `Enrolments approved: ${r.enrolmentsApproved} · Renewals approved: ${r.renewalsApproved}`,
    `Automatic renewal reminders sent: ${r.autoReminders}`,
  ];
  html += list(items);
  if (r.rate !== null) html += muted("Attendance rate = attended ÷ everyone marked (attended, marked absent or missed).");
  return html;
}

function renderForms({ created, perForm }, adminOrigin) {
  let html = h2("📝 Forms");
  if (!created.length && !perForm.length) return html + muted("No open forms and no responses this week.");
  if (created.length) html += p(`Created this week: ${created.map((f) => `<strong>${esc(f.title)}</strong>`).join(", ")}`);
  if (perForm.length) {
    html += list(perForm.map(({ form, thisWeek, total, toReview }) => {
      const status = form.status === "open" ? "published" : form.status === "closed" ? "unpublished" : form.status;
      return `<strong>${esc(form.title)}</strong> <span style="color:${C.soft};">(${esc(status)})</span> — ${plural(thisWeek, "new response")} this week · ${total} in total${toReview ? ` · <strong>${toReview} not yet reviewed</strong>` : ""}`;
    }));
  }
  if (adminOrigin) html += muted(`See the full answers in the admin app → Forms.`);
  return html;
}

function renderMessages(messages) {
  let html = h2(`✉️ Unread messages${messages.length ? ` (${messages.length})` : ""}`);
  if (!messages.length) return html + muted("No unread messages.");
  html += list(messages.map((m) =>
    `<strong>${esc(m.name || "Someone")}</strong>${m.email ? ` <span style="color:${C.soft};">(${esc(m.email)})</span>` : ""} — “${esc(plainText(m.message, 160))}” <span style="color:${C.soft};">· ${esc(shortDay(sydneyDateOf(m.created_at)))}</span>`));
  return html + muted("Mark them as read on the Dashboard once they've been dealt with.");
}

// Builds the email. test: null for the scheduled send, truthy for "Send a
// test now". The email can reach team members who aren't admins, so it never
// mentions Admin Config, who's on the recipient list, or who sent a test.
export function buildDigest(data, { todayStr, sections = null, test = null, adminOrigin = "" }) {
  const w = digestWindows(todayStr);
  const range = `${formatBirthdayDay(w.aheadFrom)} – ${formatBirthdayDay(w.aheadTo)}`;
  const subject = `${test ? "[Test] " : ""}Nritya Mandala weekly digest · ${range}`;

  let body = "";
  if (test) {
    body += `<div style="background:#fff4d6;border:1px solid ${C.gold};border-radius:8px;padding:12px 14px;margin-bottom:18px;font-size:13px;line-height:1.5;color:${C.ink};">
<strong>🧪 Test send.</strong> Test sends only go to the studio email, not to the rest of the team.</div>`;
  }
  body += p(`Here's the studio's week — looking ahead to <strong>${esc(range)}</strong>, and back at ${esc(formatBirthdayDay(w.pastFrom))} – ${esc(formatBirthdayDay(w.pastTo))}.`);

  const counts = {};
  if (isSectionOn(sections, "week_ahead")) {
    const days = weekAhead(data, todayStr);
    counts.classesAhead = days.reduce((n, d) => n + d.classes.length, 0);
    body += renderWeekAhead(days, data.notices);
  }
  if (isSectionOn(sections, "birthdays")) {
    const b = digestBirthdays(data, todayStr);
    counts.birthdays = b.coming.length + b.belated.length;
    body += renderBirthdays(b);
  }
  if (isSectionOn(sections, "attention")) {
    const a = needsAttention(data, todayStr);
    counts.attention = a.pendingEnrolments.length + a.pendingRenewals.length + a.outOfClasses.length + a.runningLow.length + a.unpaidPackages.length + a.goneQuiet.length;
    body += renderAttention(a);
  }
  if (isSectionOn(sections, "last_week")) body += renderLastWeek(lastWeekRecap(data, todayStr));
  if (isSectionOn(sections, "forms")) body += renderForms(formsSummary(data, todayStr), adminOrigin);
  if (isSectionOn(sections, "messages")) body += renderMessages(unreadMessages(data));

  const footer = `<div style="margin-top:28px;padding-top:12px;border-top:1px solid ${C.line};font-size:12px;color:${C.soft};line-height:1.5;">
${adminOrigin ? `<a href="${esc(adminOrigin)}" style="color:${C.maroon};">Open the admin app</a><br/>` : ""}
Sent weekly to the Nritya Mandala team.</div>`;

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:${C.ink};">
<h1 style="font-family:Georgia,serif;font-size:22px;color:${C.maroon};margin:0 0 6px;">Nritya Mandala — weekly digest</h1>
${body}${footer}</div>`;
  return { subject, html, counts };
}
