import { supabase } from "./supabase";
import { formatTimeRange } from "./scheduling";
import { formatShortDate } from "./dates";

// Classes currently open to book into — capacity vs actual roster size, via the
// same get_effective_class_counts RPC the enrolment form already used. Includes
// start_date/end_date so callers can show "Starts <date>" for one that hasn't
// begun yet, rather than listing it as already running. A class that's full
// doesn't appear at all — used everywhere a family picks a class to move into or
// enrol in (enrolment, renewal, transfer), so none of them can dead-end on a full
// class the studio would just have to reject or juggle manually.
export async function fetchOpenClasses() {
  const [cRes, eRes] = await Promise.all([
    supabase.from("classes").select("id, label, day, time, end_time, capacity, start_date, end_date"),
    supabase.rpc("get_effective_class_counts"),
  ]);
  const counts = {};
  (eRes.data || []).forEach((row) => { counts[row.class_id] = Number(row.effective_count); });
  return (cRes.data || []).filter((c) => (counts[c.id] || 0) < c.capacity);
}

// Whether a class hasn't started yet (relative to today, YYYY-MM-DD) — used to
// decide whether to show "Starts <date>" next to it instead of its schedule as if
// it's already running.
export function classStartsInFuture(cls, todayStr) {
  return !!(cls.start_date && cls.start_date > todayStr);
}

// "Wednesday 18:00 – 19:00" as-is once it's running, or with "· Starts Sep 24"
// appended while it hasn't started yet — the label used everywhere a class shows
// up in a picker or list on a public-facing page.
export function classOptionLabel(cls, todayStr) {
  const base = `${cls.day} ${formatTimeRange(cls.time, cls.end_time)}`;
  return classStartsInFuture(cls, todayStr) ? `${base} · Starts ${formatShortDate(cls.start_date)}` : base;
}
