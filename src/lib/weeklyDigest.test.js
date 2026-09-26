// Unit tests for weeklyDigest.js — run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  digestWindows, isDigestDue, isSectionOn, weekAhead, wishingClass, digestBirthdays, needsAttention,
  lastWeekRecap, formsSummary, unreadMessages, buildDigest, plainText, esc, formatHour, loadDigestData,
} from "./weeklyDigest.js";

// Digest sent Friday 2 Oct 2026: week ahead Sat 3 – Fri 9 Oct, past week Sat 26 Sep – Fri 2 Oct.
const today = "2026-10-02";
const sat = { id: "sat", label: "Juniors", day: "Saturday", time: "10:00", end_time: "11:00", start_date: null, end_date: null };
const wed = { id: "wed", label: "Seniors", day: "Wednesday", time: "18:00", end_time: "19:00", start_date: null, end_date: null };

function fixture(overrides = {}) {
  return {
    classes: [sat, wed],
    enrollments: [
      { student_id: "s1", class_id: "sat", start_date: "2026-01-01" },
      { student_id: "s2", class_id: "sat", start_date: "2026-01-01" },
      { student_id: "s3", class_id: "wed", start_date: "2026-01-01" },
      { student_id: "s4", class_id: "sat", start_date: "2026-10-10" }, // starts after next week
    ],
    skips: [{ class_id: "wed", date: "2026-10-07", reason: "Public holiday" }],
    attendance: [
      { student_id: "s1", class_id: "sat", date: "2026-10-03", status: "skipped" },
      { student_id: "s1", class_id: "sat", date: "2026-09-26", status: "attended" },
      { student_id: "s2", class_id: "sat", date: "2026-09-26", status: "missed" },
      { student_id: "s3", class_id: "wed", date: "2026-09-30", status: "attended" },
      { student_id: "s3", class_id: "wed", date: "2026-09-19", status: "attended" }, // before the past week
    ],
    students: [
      { id: "s1", name: "Asha", code: "ASHA", dob: "2016-10-05", created_at: "2025-01-01T00:00:00Z" },
      { id: "s2", name: "Bina", code: "BINA", dob: "2015-09-28", created_at: "2026-09-27T01:00:00Z" },
      { id: "s3", name: "Chet", code: "CHET", dob: "2017-10-03", created_at: "2025-01-01T00:00:00Z" },
      { id: "s4", name: "Dev", code: "DEV", dob: null, created_at: "2026-09-25T10:00:00Z" }, // 25 Sep 20:00 Sydney: before the window
    ],
    packageSummaries: [
      { student_id: "s1", classes_total: 10, classes_used: 9 },
      { student_id: "s2", classes_total: 10, classes_used: 10 },
      { student_id: "s3", classes_total: 10, classes_used: 3 },
    ],
    notices: [{ message: "<p>Closed on <strong>7 Oct</strong> &amp; back after</p>", start_date: "2026-10-01", end_date: "2026-10-08", show_on_public: true, show_on_parent: true }],
    pendingEnrolments: [{ id: "e1", reference: "NM-1", guardian_name: "Sita", created_at: "2026-10-01T00:00:00Z", is_transfer: false, enrollment_request_students: [{ student_name: "Mina" }] }],
    pendingRenewals: [{ id: "r1", student_id: "s2", created_at: "2026-10-01T00:00:00Z", tier_name_snapshot: "10 classes", students: { name: "Bina", code: "BINA" } }],
    unpaidPackages: [
      { id: "p1", purchase_date: "2026-09-20", tier_name: "10 classes", classes_total: 10, students: { name: "Chet", code: "CHET", archived: false } },
      { id: "p2", purchase_date: "2026-09-20", tier_name: "10 classes", classes_total: 10, students: { name: "Old", code: "OLD", archived: true } },
    ],
    reviewedEnrolments: [{ id: "e0", reviewed_at: "2026-09-27T02:00:00Z" }, { id: "e9", reviewed_at: "2026-09-25T02:00:00Z" }],
    reviewedRenewals: [{ id: "r0", reviewed_at: "2026-10-02T03:00:00Z" }],
    autoReminders: [{ sent_at: "2026-09-28T22:00:00Z" }, { sent_at: "2026-09-28T22:00:05Z" }],
    forms: [
      { id: "f1", code: "SURVEY", title: "Parent survey", status: "open", created_at: "2026-09-28T00:00:00Z" },
      { id: "f2", code: "OLD", title: "Old form", status: "closed", created_at: "2026-01-01T00:00:00Z" },
      { id: "f3", code: "DRAFT", title: "Draft form", status: "draft", created_at: "2026-01-01T00:00:00Z" },
    ],
    formResponses: [
      { form_id: "f1", status: "new", submitted_at: "2026-09-29T00:00:00Z" },
      { form_id: "f1", status: "reviewed", submitted_at: "2026-09-10T00:00:00Z" },
      { form_id: "f2", status: "new", submitted_at: "2026-01-10T00:00:00Z" },
    ],
    contactMessages: [
      { name: "Ram", email: "ram@example.com", message: "Do you have <b>adult</b> classes?", created_at: "2026-09-30T00:00:00Z", read: false },
      { name: "Old", email: "old@example.com", message: "Still waiting", created_at: "2026-08-01T00:00:00Z", read: false },
      { name: "Done", email: "done@example.com", message: "Already handled", created_at: "2026-09-29T00:00:00Z", read: true },
    ],
    dueThreshold: 2,
    ...overrides,
  };
}

test("digestWindows", () => {
  assert.deepEqual(digestWindows(today), { aheadFrom: "2026-10-03", aheadTo: "2026-10-09", pastFrom: "2026-09-26", pastTo: "2026-10-02" });
});

test("isDigestDue: Sydney weekday + hour, once per day", () => {
  // Fri 2 Oct 2026 20:15 Sydney (AEST, +10) = 10:15 UTC.
  const fri8pm = new Date("2026-10-02T10:15:00Z");
  assert.equal(isDigestDue({ now: fri8pm }), true);
  assert.equal(isDigestDue({ now: fri8pm, lastSentOn: "2026-10-02" }), false);
  assert.equal(isDigestDue({ now: fri8pm, lastSentOn: "2026-09-25" }), true);
  assert.equal(isDigestDue({ now: new Date("2026-10-02T09:15:00Z") }), false); // 7pm
  assert.equal(isDigestDue({ now: fri8pm, day: "Saturday" }), false);
  // After daylight saving starts (AEDT, +11): Fri 9 Oct 20:05 = 09:05 UTC.
  assert.equal(isDigestDue({ now: new Date("2026-10-09T09:05:00Z") }), true);
  assert.equal(isDigestDue({ now: new Date("2026-10-09T10:05:00Z") }), false);
});

test("isSectionOn: missing means on", () => {
  assert.equal(isSectionOn(null, "forms"), true);
  assert.equal(isSectionOn({}, "forms"), true);
  assert.equal(isSectionOn({ forms: false }, "forms"), false);
  assert.equal(isSectionOn({ forms: true }, "forms"), true);
});

test("weekAhead: booked counts from start dates, who's away, cancelled classes", () => {
  const days = weekAhead(fixture(), today);
  assert.deepEqual(days.map((d) => d.dateStr), ["2026-10-03", "2026-10-07"]);
  const satDay = days[0].classes[0];
  assert.equal(satDay.booked, 2); // s4 starts 10 Oct
  assert.deepEqual(satDay.away, ["Asha"]);
  assert.equal(satDay.lowTurnout, true); // 1 of 2 expected
  assert.equal(days[1].classes.length, 0);
  assert.equal(days[1].cancelled[0].reason, "Public holiday");
});

test("wishingClass: on the day, else the class before, else belated", () => {
  const opts = { skips: [] };
  assert.deepEqual(wishingClass([sat], "2026-10-03", "2026-10-03", opts), { when: "on_day", dateStr: "2026-10-03", cls: sat });
  assert.deepEqual(wishingClass([sat, wed], "2026-10-06", "2026-10-03", opts), { when: "early", dateStr: "2026-10-03", cls: sat });
  assert.deepEqual(wishingClass([wed], "2026-10-05", "2026-10-03", opts), { when: "belated", dateStr: "2026-10-07", cls: wed });
  // Class before is cancelled -> belated at the next one.
  assert.equal(wishingClass([sat], "2026-10-06", "2026-10-03", { skips: [{ class_id: "sat", date: "2026-10-03" }] }).dateStr, "2026-10-10");
  // Past birthday -> the first class from `from`.
  assert.deepEqual(wishingClass([sat], "2026-09-28", "2026-10-03", opts), { when: "belated", dateStr: "2026-10-03", cls: sat });
  assert.equal(wishingClass([], "2026-10-06", "2026-10-03", opts), null);
});

test("digestBirthdays: next week and belated, honouring absences and cancellations", () => {
  const { coming, belated } = digestBirthdays(fixture(), today);
  // Asha (5 Oct): away on Sat 3 Oct, so belated at Sat 10 Oct.
  // Chet (3 Oct, a Saturday): Wednesday class on 7 Oct is cancelled -> belated 14 Oct.
  assert.deepEqual(coming.map((b) => [b.student.name, b.birthday.dateStr, b.birthday.age, b.wish?.when, b.wish?.dateStr]), [
    ["Chet", "2026-10-03", 9, "belated", "2026-10-14"],
    ["Asha", "2026-10-05", 10, "belated", "2026-10-10"],
  ]);
  // Bina (28 Sep) -> belated at Sat 3 Oct.
  assert.deepEqual(belated.map((b) => [b.student.name, b.birthday.age, b.wish?.dateStr]), [["Bina", 11, "2026-10-03"]]);
});

test("needsAttention", () => {
  const a = needsAttention(fixture(), today);
  assert.deepEqual(a.outOfClasses.map((r) => [r.student.name, r.hasPackage, r.renewalRequested]), [["Bina", true, true], ["Dev", false, false]]);
  assert.deepEqual(a.runningLow.map((r) => [r.student.name, r.remaining]), [["Asha", 1]]);
  assert.deepEqual(a.unpaidPackages.map((p) => p.id), ["p1"]);
  assert.equal(a.pendingEnrolments.length, 1);
  assert.deepEqual(a.goneQuiet.map((s) => s.id), []);
});

test("lastWeekRecap counts only the past week (Sydney dates)", () => {
  const r = lastWeekRecap(fixture(), today);
  assert.equal(r.classesHeld, 2); // Sat 26 Sep + Wed 30 Sep
  assert.equal(r.attended, 2);
  assert.equal(r.missed, 1);
  assert.equal(r.markedAbsent, 0);
  assert.equal(r.rate, 67);
  assert.deepEqual(r.newStudents.map((s) => s.name), ["Bina"]);
  assert.equal(r.enrolmentsApproved, 1);
  assert.equal(r.renewalsApproved, 1);
  assert.equal(r.autoReminders, 2);
  assert.equal(lastWeekRecap(fixture({ attendance: [] }), today).rate, null);
});

test("formsSummary and unreadMessages", () => {
  const f = formsSummary(fixture(), today);
  assert.deepEqual(f.created.map((x) => x.id), ["f1"]);
  assert.deepEqual(f.perForm.map((x) => [x.form.id, x.thisWeek, x.total, x.toReview]), [["f1", 1, 2, 1]]);
  // Every unread message, however old; read ones never.
  assert.deepEqual(unreadMessages(fixture()).map((m) => m.name), ["Ram", "Old"]);
});

test("buildDigest: subject, sections switch off, test banner, escaping, no money", () => {
  const full = buildDigest(fixture(), { todayStr: today, adminOrigin: "https://admin.example.com" });
  assert.match(full.subject, /^Nritya Mandala weekly digest · Sat 3 Oct – Fri 9 Oct$/);
  for (const heading of ["Week ahead", "Birthdays", "Needs attention", "Last week", "Forms", "Unread messages (2)"]) assert.ok(full.html.includes(heading), heading);
  assert.ok(full.html.includes("Still waiting"));
  assert.ok(!full.html.includes("Already handled"));
  assert.ok(full.html.includes("Closed on 7 Oct &amp; back after"));
  assert.ok(full.html.includes("Do you have adult classes?"));
  assert.ok(!full.html.includes("<b>adult</b>"));
  assert.ok(!/\$\d/.test(full.html), "no money amounts");
  assert.ok(!full.html.includes("Test send"));

  const some = buildDigest(fixture(), { todayStr: today, sections: { forms: false, messages: false } });
  assert.ok(!some.html.includes("📝 Forms"));
  assert.ok(!some.html.includes("Unread messages"));
  assert.ok(some.html.includes("Week ahead"));

  const t = buildDigest(fixture(), { todayStr: today, test: { requestedBy: "me@example.com", studioEmail: "studio@example.com", scheduledRecipients: ["staff@example.com"] } });
  assert.match(t.subject, /^\[Test\] /);
  assert.ok(t.html.includes("Test sends only go to the studio email"));
  // Never Admin Config details: not the settings screen, the recipient list or the requester.
  for (const html of [t.html, full.html]) {
    assert.ok(!html.includes("Admin Config"));
    assert.ok(!html.includes("staff@example.com"));
    assert.ok(!html.includes("me@example.com"));
  }
});

test("helpers", () => {
  assert.equal(esc(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  assert.equal(plainText("<p>Hello</p><p>there&nbsp;you</p>"), "Hello there you");
  assert.equal(plainText("abcdefghij", 5), "abcd…");
  assert.deepEqual([0, 9, 12, 20].map(formatHour), ["12am", "9am", "12pm", "8pm"]);
});

test("loadDigestData asks for the right windows and defaults the threshold", async () => {
  const paths = [];
  const data = await loadDigestData(async (path) => { paths.push(path); return []; }, today);
  assert.equal(data.dueThreshold, 2);
  assert.ok(paths.includes("class_skips?select=class_id,date,reason&date=gte.2026-09-26&date=lte.2026-10-09"));
  assert.ok(paths.some((p) => p.startsWith("email_log?") && p.includes("sent_at=gte.2026-09-25T00:00:00Z")));
  assert.ok(paths.some((p) => p.startsWith("contact_messages?") && p.includes("read=eq.false")));
});
