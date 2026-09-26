// Unit tests for birthdays.js — run with `npm test` (Node's built-in runner).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isBirthdayOn, nextBirthday, upcomingBirthdays, birthdayBeforeNextClass, formatBirthdayDate, formatBirthdayDay,
} from "./birthdays.js";

// 26 Sep 2026 is a Saturday.
const sat = { id: "c1", day: "Saturday", time: "10:00", end_time: "11:00", start_date: null, end_date: null };

test("nextBirthday: today, tomorrow, already passed, year wrap", () => {
  assert.deepEqual(nextBirthday("2017-09-26", "2026-09-26"), { dateStr: "2026-09-26", daysUntil: 0, age: 9 });
  assert.equal(nextBirthday("2015-09-27", "2026-09-26").daysUntil, 1);
  assert.deepEqual(nextBirthday("2015-09-01", "2026-09-26"), { dateStr: "2027-09-01", daysUntil: 340, age: 12 });
  assert.deepEqual(nextBirthday("2016-01-02", "2026-12-30"), { dateStr: "2027-01-02", daysUntil: 3, age: 11 });
  assert.equal(nextBirthday(null, "2026-09-26"), null);
});

test("29 February birthdays fall on 28 February in non-leap years", () => {
  assert.equal(nextBirthday("2016-02-29", "2027-02-01").dateStr, "2027-02-28");
  assert.equal(nextBirthday("2016-02-29", "2028-02-01").dateStr, "2028-02-29");
  assert.equal(isBirthdayOn("2016-02-29", "2027-02-28"), true);
});

test("isBirthdayOn", () => {
  assert.equal(isBirthdayOn("2017-09-26", "2026-09-26"), true);
  assert.equal(isBirthdayOn("2017-09-26", "2026-09-27"), false);
  assert.equal(isBirthdayOn(null, "2026-09-26"), false);
});

test("upcomingBirthdays: within the window, soonest first, no DOB ignored", () => {
  const students = [
    { name: "B", dob: "2015-10-05" },
    { name: "A", dob: "2017-09-26" },
    { name: "C", dob: "2015-11-30" },
    { name: "D", dob: null },
  ];
  assert.deepEqual(upcomingBirthdays(students, "2026-09-26", 14).map((b) => b.name), ["A", "B"]);
});

test("birthdayBeforeNextClass uses the next class that actually runs", () => {
  // Tue 29 Sep, next class Sat 3 Oct -> flag today.
  assert.equal(birthdayBeforeNextClass("2015-09-29", sat, "2026-09-26")?.dateStr, "2026-09-29");
  // On the next class day itself -> not flagged (gets the on-the-day badge then).
  assert.equal(birthdayBeforeNextClass("2015-10-03", sat, "2026-09-26"), null);
  // Tue 6 Oct: normally after the 3 Oct class -> not flagged...
  assert.equal(birthdayBeforeNextClass("2015-10-06", sat, "2026-09-26"), null);
  // ...but flagged if the studio cancelled 3 Oct...
  assert.equal(birthdayBeforeNextClass("2015-10-06", sat, "2026-09-26", { skips: [{ class_id: "c1", date: "2026-10-03" }] })?.dateStr, "2026-10-06");
  // ...or the student said they'll miss 3 Oct.
  assert.equal(birthdayBeforeNextClass("2015-10-06", sat, "2026-09-26", { excludeDates: new Set(["2026-10-03"]) })?.dateStr, "2026-10-06");
  // No next class (term ended) -> looks a week ahead.
  assert.equal(birthdayBeforeNextClass("2015-09-30", { ...sat, end_date: "2026-09-26" }, "2026-09-26")?.dateStr, "2026-09-30");
  assert.equal(birthdayBeforeNextClass(null, sat, "2026-09-26"), null);
});

test("formatting", () => {
  assert.match(formatBirthdayDate("2026-10-20"), /^20 Oct/);
  assert.match(formatBirthdayDay("2026-10-01"), /^Thu 1 Oct/);
});
