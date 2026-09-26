// Unit tests for quietChurn.js — run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { findQuietStudents } from "./quietChurn.js";

const today = "2026-10-02";
const base = {
  students: [{ id: "a", name: "Asha" }, { id: "b", name: "Bina" }, { id: "c", name: "Chet" }, { id: "d", name: "Dev" }, { id: "e", name: "Esha" }],
  enrollments: [
    { student_id: "a", start_date: "2026-08-01" },
    { student_id: "b", start_date: null },
    { student_id: "c", start_date: "2026-09-30" }, // booked too recently to judge
    { student_id: "d", start_date: "2026-08-01" },
    // e isn't booked in anywhere
  ],
  packageSummaries: [
    { student_id: "a", classes_total: 10, classes_used: 4 },
    { student_id: "b", classes_total: 10, classes_used: 2 },
    { student_id: "c", classes_total: 10, classes_used: 0 },
    { student_id: "d", classes_total: 10, classes_used: 10 }, // out of classes: renewal, not "quiet"
    { student_id: "e", classes_total: 10, classes_used: 0 },
  ],
  attendance: [
    { student_id: "a", date: "2026-09-05", status: "attended" },
    { student_id: "a", date: "2026-09-26", status: "skipped" },
    { student_id: "b", date: "2026-09-26", status: "attended" },
  ],
};

test("flags booked students with classes left who haven't attended in 14 days", () => {
  const quiet = findQuietStudents({ ...base, todayStr: today });
  assert.deepEqual(quiet.map((s) => s.id), ["a"]);
  assert.equal(quiet[0].lastAttended, "2026-09-05");
  assert.equal(quiet[0].daysSince, 27);
  assert.equal(quiet[0].remaining, 6);
});

test("never attended counts as quiet (listed first); exactly 14 days ago counts", () => {
  const quiet = findQuietStudents({
    ...base,
    attendance: [{ student_id: "a", date: "2026-09-18", status: "attended" }, { student_id: "b", date: "2026-09-19", status: "attended" }],
    enrollments: [...base.enrollments, { student_id: "e", start_date: "2026-01-01" }],
    todayStr: today,
  });
  assert.deepEqual(quiet.map((s) => s.id), ["e", "a"]);
  assert.equal(quiet[0].lastAttended, null);
});
