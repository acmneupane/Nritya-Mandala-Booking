// Unit tests for scheduling.js — run with `npm test` (Node's built-in runner).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDaysToDateStr, weekdayOfDateStr, classRunsOn, isClassSkippedOn, classOccurrences,
  nextClassDateAfter, upcomingOccurrencesOf, nextOccurrenceOf, occurrencesInRange, classesOnDate,
  compareClassSchedule,
} from "./scheduling.js";
import { localDateStr } from "./dates.js";

// 26 Sep 2026 is a Saturday.
const sat = { id: "c1", label: "Juniors", day: "Saturday", time: "10:00", end_time: "11:00", start_date: null, end_date: null };
const wed = { id: "c2", label: "Seniors", day: "Wednesday", time: "18:00", end_time: "19:00", start_date: null, end_date: null };
const skip = (cls, date) => ({ class_id: cls.id, date });

test("addDaysToDateStr rolls over months, years and leap days", () => {
  assert.equal(addDaysToDateStr("2026-09-26", 3), "2026-09-29");
  assert.equal(addDaysToDateStr("2026-09-30", 1), "2026-10-01");
  assert.equal(addDaysToDateStr("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysToDateStr("2028-02-28", 1), "2028-02-29");
  assert.equal(addDaysToDateStr("2027-02-28", 1), "2027-03-01");
  assert.equal(addDaysToDateStr("2026-10-01", -1), "2026-09-30");
});

test("weekdayOfDateStr", () => {
  assert.equal(weekdayOfDateStr("2026-09-26"), "Saturday");
  assert.equal(weekdayOfDateStr("2026-09-28"), "Monday");
  assert.equal(weekdayOfDateStr("2026-10-04"), "Sunday"); // Sydney daylight saving starts this day
});

test("classRunsOn checks the weekday and the class's term (inclusive)", () => {
  assert.equal(classRunsOn(sat, "2026-09-26"), true);
  assert.equal(classRunsOn(sat, "2026-09-27"), false);
  const termed = { ...sat, start_date: "2026-10-03", end_date: "2026-10-17" };
  assert.equal(classRunsOn(termed, "2026-09-26"), false);
  assert.equal(classRunsOn(termed, "2026-10-03"), true);
  assert.equal(classRunsOn(termed, "2026-10-17"), true);
  assert.equal(classRunsOn(termed, "2026-10-24"), false);
});

test("isClassSkippedOn only matches the same class and date", () => {
  assert.equal(isClassSkippedOn(sat, "2026-10-03", [skip(sat, "2026-10-03")]), true);
  assert.equal(isClassSkippedOn(sat, "2026-10-03", [skip(wed, "2026-10-03")]), false);
  assert.equal(isClassSkippedOn(sat, "2026-10-10", [skip(sat, "2026-10-03")]), false);
});

test("classOccurrences: from is inclusive, skips/excludeDates removed, count/to respected", () => {
  assert.deepEqual(classOccurrences(sat, { from: "2026-09-26", count: 3 }), ["2026-09-26", "2026-10-03", "2026-10-10"]);
  assert.deepEqual(classOccurrences(sat, { from: "2026-09-27", count: 2 }), ["2026-10-03", "2026-10-10"]);
  assert.deepEqual(
    classOccurrences(sat, { from: "2026-09-26", count: 3, skips: [skip(sat, "2026-10-03")], excludeDates: new Set(["2026-10-10"]) }),
    ["2026-09-26", "2026-10-17", "2026-10-24"],
  );
  assert.deepEqual(classOccurrences(sat, { from: "2026-09-26", to: "2026-10-10" }), ["2026-09-26", "2026-10-03", "2026-10-10"]);
  assert.deepEqual(classOccurrences(sat, { from: "2026-09-26", lookaheadDays: 7 }), ["2026-09-26"]);
  assert.deepEqual(classOccurrences({ ...sat, day: "Someday" }, { from: "2026-09-26", count: 3 }), []);
  assert.deepEqual(classOccurrences({ ...sat, end_date: "2026-10-03" }, { from: "2026-09-26", count: 5 }), ["2026-09-26", "2026-10-03"]);
});

test("nextClassDateAfter excludes the given date and honours skips / absences / term end", () => {
  assert.equal(nextClassDateAfter(sat, "2026-09-26"), "2026-10-03");
  assert.equal(nextClassDateAfter(sat, "2026-09-26", { skips: [skip(sat, "2026-10-03")] }), "2026-10-10");
  assert.equal(nextClassDateAfter(sat, "2026-09-26", { excludeDates: new Set(["2026-10-03", "2026-10-10"]) }), "2026-10-17");
  assert.equal(nextClassDateAfter({ ...sat, end_date: "2026-09-26" }, "2026-09-26"), null);
  assert.equal(nextClassDateAfter(wed, "2026-09-26"), "2026-09-30");
});

test("upcomingOccurrencesOf / nextOccurrenceOf use Sydney's date and time, whatever the device timezone", () => {
  // 25 Sep 23:00 UTC = Sat 26 Sep 09:00 in Sydney: today's 10:00 class is still to come.
  const beforeClass = new Date("2026-09-25T23:00:00Z");
  assert.deepEqual(upcomingOccurrencesOf(sat, [], localDateStr, { count: 2, now: beforeClass }).map((o) => o.dateStr), ["2026-09-26", "2026-10-03"]);
  // 26 Sep 09:00 UTC = Sat 26 Sep 19:00 in Sydney: today's class has finished.
  const afterClass = new Date("2026-09-26T09:00:00Z");
  assert.equal(nextOccurrenceOf(sat, [], localDateStr, 60, undefined, afterClass).dateStr, "2026-10-03");
  // Skipped next week too -> the one after.
  assert.equal(nextOccurrenceOf(sat, [skip(sat, "2026-10-03")], localDateStr, 60, undefined, afterClass).dateStr, "2026-10-10");
  // Student already said they'll miss 3 Oct.
  assert.equal(nextOccurrenceOf(sat, [], localDateStr, 60, new Set(["2026-10-03"]), afterClass).dateStr, "2026-10-10");
  // The Date returned is for display and lands on the right weekday.
  const occ = nextOccurrenceOf(sat, [], localDateStr, 60, undefined, afterClass);
  assert.equal(occ.date.getDay(), 6);
  // Lookahead window: count 20 but only 7 days -> just the one Saturday.
  assert.equal(upcomingOccurrencesOf(sat, [], localDateStr, { count: 20, lookaheadDays: 7, now: beforeClass }).length, 1);
  assert.equal(nextOccurrenceOf({ ...sat, end_date: "2026-09-20" }, [], localDateStr, 60, undefined, beforeClass), null);
});

test("occurrencesInRange counts runs in an inclusive range, minus skips", () => {
  assert.equal(occurrencesInRange(sat, [], localDateStr, "2026-09-01", "2026-09-30"), 4); // 5, 12, 19, 26 Sep
  assert.equal(occurrencesInRange(sat, [skip(sat, "2026-09-12")], localDateStr, "2026-09-01", "2026-09-30"), 3);
  assert.equal(occurrencesInRange(sat, [], localDateStr, "2026-09-26", "2026-09-26"), 1);
  assert.equal(occurrencesInRange(sat, [], localDateStr, "2026-09-30", "2026-09-01"), 0);
});

test("classesOnDate filters by weekday/term, sorts by time, optionally drops cancelled", () => {
  const early = { ...sat, id: "c3", time: "09:00" };
  const classes = [sat, wed, early];
  assert.deepEqual(classesOnDate(classes, "2026-09-26").map((c) => c.id), ["c3", "c1"]);
  assert.deepEqual(classesOnDate(classes, "2026-09-26", [skip(sat, "2026-09-26")]).map((c) => c.id), ["c3"]);
  assert.deepEqual(classesOnDate(classes, "2026-09-30").map((c) => c.id), ["c2"]);
  assert.deepEqual(classesOnDate(classes, "2026-09-27"), []);
});

test("compareClassSchedule orders Monday..Sunday then by time", () => {
  const sorted = [sat, wed, { ...wed, id: "c4", time: "17:00" }].sort(compareClassSchedule).map((c) => c.id);
  assert.deepEqual(sorted, ["c4", "c2", "c1"]);
});
