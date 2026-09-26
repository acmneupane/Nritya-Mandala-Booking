import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Field, Modal, ConfirmModal } from "./ui";
import { isClassActiveOn, formatTimeRange } from "../lib/scheduling";
import { localDateStr } from "../lib/dates";
import { isBirthdayOn } from "../lib/birthdays";
import { isLowAttendanceRisk } from "../lib/attendance";
import QrScanner from "./QrScanner";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const VIEW_MODES = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "fortnight", label: "Fortnight" },
  { id: "month", label: "Month" },
];

function mondayOf(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function saturdayOnOrAfter(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun ... 6 = Sat
  d.setDate(d.getDate() + ((6 - day + 7) % 7));
  return d;
}

// Returns the array of { date, inMonth } entries the current view mode should
// display — Monday through Saturday only (the studio doesn't run Sunday classes),
// so every row is a clean 6-column week.
function datesForView(mode, anchor) {
  if (mode === "day") return [{ date: anchor, inMonth: true }];
  if (mode === "week") {
    const start = mondayOf(anchor);
    return Array.from({ length: 6 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return { date: d, inMonth: true }; });
  }
  if (mode === "fortnight") {
    const start = mondayOf(anchor);
    const out = [];
    for (let w = 0; w < 2; w++) {
      for (let i = 0; i < 6; i++) { const d = new Date(start); d.setDate(start.getDate() + w * 7 + i); out.push({ date: d, inMonth: true }); }
    }
    return out;
  }
  // month: a proper Mon-Sat calendar grid, padded with the trailing/leading days of
  // adjacent months (dimmed) so every week lines up into exactly 6 columns.
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const gridStart = mondayOf(first);
  const gridEnd = saturdayOnOrAfter(last);
  const out = [];
  for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0) continue; // skip Sundays
    out.push({ date: new Date(d), inMonth: d.getMonth() === anchor.getMonth() });
  }
  return out;
}

function navAnchor(mode, anchor, dir) {
  const d = new Date(anchor);
  if (mode === "day") d.setDate(d.getDate() + dir);
  else if (mode === "week") d.setDate(d.getDate() + dir * 7);
  else if (mode === "fortnight") d.setDate(d.getDate() + dir * 14);
  else d.setMonth(d.getMonth() + dir);
  return d;
}

function rangeLabel(mode, anchor, dates) {
  if (mode === "day") return anchor.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  if (mode === "month") return anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const start = dates[0].date, end = dates[dates.length - 1].date;
  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function RosterEditor({ cls, onChanged }) {
  const [students, setStudents] = useState([]);
  const [roster, setRoster] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [remainingByStudent, setRemainingByStudent] = useState({});
  const [addingStudent, setAddingStudent] = useState("");
  const [addingStartDate, setAddingStartDate] = useState(cls.dateStr);
  const [addingModalOpen, setAddingModalOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, eRes, aRes] = await Promise.all([
      // Fetch every student, not just active ones — a student who was archived (or
      // whose package lapsed) without being removed from this class first would
      // otherwise vanish from the roster below while still counting toward
      // "N booked" above, which is exactly the "1 booked but can't see anyone"
      // bug this is fixing. They're shown with a warning instead, so the admin can
      // actually remove them.
      supabase.from("students").select("id, name, archived, dob"),
      supabase.from("enrollments").select("id, student_id, start_date").eq("class_id", cls.id),
      supabase.from("attendance").select("id, student_id, status").eq("class_id", cls.id).eq("date", cls.dateStr),
    ]);
    setStudents(sRes.data || []);
    // Only show students whose booking had actually started by this date — a
    // student added today shouldn't retroactively show up in last week's roster.
    // Existing bookings from before this feature have no start_date recorded, so
    // they're treated as always-active (unrestricted), same as before.
    const activeRoster = (eRes.data || []).filter((e) => !e.start_date || e.start_date <= cls.dateStr);
    setRoster(activeRoster);
    setAttendance(aRes.data || []);
    const rosterIds = activeRoster.map((e) => e.student_id);
    if (rosterIds.length) {
      const { data: pkgRows } = await supabase.from("student_package_summary").select("student_id, classes_total, classes_used").in("student_id", rosterIds);
      const map = {};
      (pkgRows || []).forEach((p) => { map[p.student_id] = p.classes_total - p.classes_used; });
      setRemainingByStudent(map);
    }
    setLoading(false);
  }, [cls.id, cls.dateStr]);

  useEffect(() => { load(); }, [load]);

  const studentById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students]);
  const availableStudents = students.filter((s) => !s.archived && !roster.some((r) => r.student_id === s.id)).sort((a, b) => a.name.localeCompare(b.name));
  const atRiskCount = roster.filter((r) => {
    const student = studentById[r.student_id];
    if (!student) return true; // booked, but the student record itself is gone
    return student.archived || (remainingByStudent[student.id] ?? 0) <= 0;
  }).length;

  const enroll = async () => {
    if (!addingStudent) return;
    await supabase.from("enrollments").insert({ student_id: addingStudent, class_id: cls.id, start_date: addingStartDate || cls.dateStr });
    setAddingStudent("");
    setAddingModalOpen(false);
    load();
    onChanged();
  };
  const unenroll = async (enrollmentId) => {
    await supabase.from("enrollments").delete().eq("id", enrollmentId);
    load();
    onChanged();
  };
  const setStatus = async (studentId, status) => {
    const existing = attendance.find((a) => a.student_id === studentId);
    if (existing && existing.status === status) {
      await supabase.from("attendance").delete().eq("id", existing.id);
    } else if (existing) {
      await supabase.from("attendance").update({ status }).eq("id", existing.id);
    } else {
      await supabase.from("attendance").insert({ student_id: studentId, class_id: cls.id, date: cls.dateStr, status });
    }
    load();
  };
  const clearStatus = async (studentId) => {
    const existing = attendance.find((a) => a.student_id === studentId);
    if (existing) await supabase.from("attendance").delete().eq("id", existing.id);
    load();
  };
  const checkInByCode = async (code) => {
    const { data: student } = await supabase.from("students").select("id, name, dob").eq("code", code).eq("archived", false).maybeSingle();
    if (!student) return { ok: false, message: "Code not recognized" };

    const { data: existingEnrollment } = await supabase.from("enrollments").select("id").eq("student_id", student.id).eq("class_id", cls.id).maybeSingle();
    if (!existingEnrollment) {
      await supabase.from("enrollments").insert({ student_id: student.id, class_id: cls.id });
    }
    const { data: existingAttendance } = await supabase.from("attendance").select("id, status").eq("student_id", student.id).eq("class_id", cls.id).eq("date", cls.dateStr).maybeSingle();
    if (existingAttendance) {
      if (existingAttendance.status !== "attended") await supabase.from("attendance").update({ status: "attended" }).eq("id", existingAttendance.id);
    } else {
      await supabase.from("attendance").insert({ student_id: student.id, class_id: cls.id, date: cls.dateStr, status: "attended" });
    }
    load();
    onChanged();
    return { ok: true, message: `${student.name} checked in ✓${isBirthdayOn(student.dob, cls.dateStr) ? " — 🎂 it's their birthday today!" : ""}` };
  };

  if (loading) return <p style={{ color: T.inkSoft, fontSize: 13 }}>Loading…</p>;

  const attendedCount = attendance.filter((a) => a.status === "attended").length;
  const missedCount = attendance.filter((a) => a.status === "missed").length;
  const skippedCount = attendance.filter((a) => a.status === "skipped").length;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div style={{ fontSize: 12, color: T.inkSoft }}>
          <strong style={{ color: T.ink }}>{roster.length}</strong> booked
          {attendedCount > 0 && <> · <strong style={{ color: T.sage }}>{attendedCount}</strong> attended</>}
          {skippedCount > 0 && <> · <strong style={{ color: T.gold }}>{skippedCount}</strong> excused</>}
          {missedCount > 0 && <> · <strong style={{ color: T.terracotta }}>{missedCount}</strong> missed</>}
          {atRiskCount > 0 && <> · <strong style={{ color: T.terracotta }}>⚠ {atRiskCount}</strong> {atRiskCount === 1 ? "hasn't" : "haven't"} renewed</>}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setScanning(true)} title="Scan to check in" style={{ fontSize: 13, fontWeight: 500, padding: "5px 10px", borderRadius: 999, border: `1px solid ${T.line}`, background: "#fff" }}>📷 Scan to check in</button>
          <Btn size="sm" onClick={() => setAddingModalOpen(true)}>+ Add student</Btn>
        </div>
      </div>
      {roster.length === 0 && <p style={{ color: T.inkSoft, fontSize: 13 }}>No one booked into this class yet.</p>}
      <div className="grid gap-2">
        {[...roster].sort((a, b) => (studentById[a.student_id]?.name || "").localeCompare(studentById[b.student_id]?.name || "")).map((r) => {
          const student = studentById[r.student_id];
          const remaining = student ? (remainingByStudent[student.id] ?? 0) : 0;
          const atRisk = !student || student.archived || remaining <= 0;
          const att = student ? attendance.find((a) => a.student_id === student.id) : null;
          return (
            <div key={r.id} style={{ border: `1px solid ${atRisk ? T.terracotta : T.line}`, borderRadius: 6, padding: "8px 10px" }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span style={{ fontSize: 13, color: T.ink }}>{student ? student.name : "Unknown student"}</span>
                {student && isBirthdayOn(student.dob, cls.dateStr) && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.maroonDark, background: `${T.gold}33`, borderRadius: 999, padding: "1px 8px" }}>🎂 Birthday!</span>
                )}
                {remaining > 0 && <span style={{ fontSize: 11, color: T.sage }}>{remaining} left</span>}
              </div>
              {atRisk && (
                <div style={{ fontSize: 11, color: T.terracotta, fontWeight: 600, marginBottom: 6 }}>
                  ⚠ {!student ? "Student record not found" : student.archived ? "Archived — no longer an active student" : "Hasn't renewed — no classes left on their package"}. Remove them from this class below.
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center flex-wrap gap-2">
                  {student && (
                    <>
                      <button onClick={() => setStatus(student.id, "attended")} title="Mark attended" style={{ fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 999, background: att?.status === "attended" ? `${T.sage}22` : "transparent", color: att?.status === "attended" ? T.sage : T.inkSoft }}>✓ Attended</button>
                      <button onClick={() => setStatus(student.id, "skipped")} title="Excused — notified in advance, doesn't count as missed" style={{ fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 999, background: att?.status === "skipped" ? `${T.gold}22` : "transparent", color: att?.status === "skipped" ? T.gold : T.inkSoft }}>⊘ Skipped</button>
                      <button onClick={() => setStatus(student.id, "missed")} title="Missed — unexpected no-show" style={{ fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 999, background: att?.status === "missed" ? `${T.terracotta}22` : "transparent", color: att?.status === "missed" ? T.terracotta : T.inkSoft }}>! Missed</button>
                      {att && (
                        <button onClick={() => clearStatus(student.id)} title="Clear this attendance mark" style={{ fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 999, color: T.inkSoft }}>↺ Undo</button>
                      )}
                    </>
                  )}
                </div>
                <button onClick={() => unenroll(r.id)} title="Remove booking" style={{ color: T.terracotta, padding: "5px 8px", flexShrink: 0 }}>✕</button>
              </div>
            </div>
          );
        })}
      </div>
      {addingModalOpen && (
        <Modal title={`Add a student to ${cls.label}`} onClose={() => setAddingModalOpen(false)}>
          {availableStudents.length === 0 ? (
            <p style={{ fontSize: 13, color: T.inkSoft }}>Everyone's already booked into this class.</p>
          ) : (
            <>
              <Field label="Student">
                <select style={inputStyle} value={addingStudent} onChange={(e) => setAddingStudent(e.target.value)}>
                  <option value="">Select a student…</option>
                  {availableStudents.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Starting from">
                <input style={inputStyle} type="date" value={addingStartDate} onChange={(e) => setAddingStartDate(e.target.value)} />
              </Field>
              <p style={{ fontSize: 11, color: T.inkSoft, marginTop: -6, marginBottom: 10 }}>They'll only show up on this class's roster from this date onward — not retroactively on past dates.</p>
              <div className="flex justify-end gap-2 mt-2">
                <Btn variant="ghost" onClick={() => { setAddingModalOpen(false); setAddingStudent(""); }}>Cancel</Btn>
                <Btn variant="success" onClick={enroll} disabled={!addingStudent}>Book</Btn>
              </div>
            </>
          )}
        </Modal>
      )}
      {scanning && (
        <QrScanner
          title={`Scan for ${cls.label}`}
          onDetected={(code) => checkInByCode(code)}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  );
}

function SkipModal({ cls, onClose, onSaved }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const bookedCount = cls.bookedCount || 0;
  const save = async () => {
    setSaving(true);
    await supabase.from("class_skips").insert({ class_id: cls.id, date: cls.dateStr, reason: reason.trim() });
    setSaving(false);
    onSaved();
  };
  return (
    <Modal title={`Skip ${cls.label} — ${cls.dateStr}`} onClose={onClose}>
      <p style={{ fontSize: 13, color: T.inkSoft, marginBottom: 12, lineHeight: 1.5 }}>
        This cancels the whole class for this one date only — e.g. a festival, public holiday, or the studio being closed. It'll still run as normal every other week. No attendance can be marked for this date while it's skipped.
      </p>
      {bookedCount > 0 && (
        <div style={{ background: `${T.terracotta}18`, border: `1px solid ${T.terracotta}55`, borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 13, color: T.terracotta, fontWeight: 600 }}>
          ⚠ {bookedCount} student{bookedCount === 1 ? " is" : "s are"} already booked into this class on this date. Consider letting them know before skipping it.
        </div>
      )}
      <Field label="Reason (optional)"><input style={inputStyle} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Diwali — studio closed" /></Field>
      <div className="flex justify-end gap-2 mt-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" onClick={save} disabled={saving}>{saving ? "Skipping…" : "Skip this class"}</Btn>
      </div>
    </Modal>
  );
}

// Full inline day view: every class scheduled that weekday, with its complete
// roster and attendance controls right on the page — no click-through needed.
function DayView({ date, classes, skips, enrollments, onSkip, onUnskip, onChanged, utilCounts, recordedByClassDate, atRiskBookings, lowAttendanceRisk, canCancelSession, students }) {
  const dateStr = localDateStr(date);
  const dayName = DAYS[(date.getDay() + 6) % 7];
  const dayClasses = classes.filter((c) => c.day === dayName && isClassActiveOn(c, dateStr)).sort((a, b) => a.time.localeCompare(b.time));
  // Active students whose birthday falls on this date (whether or not they
  // have a class today).
  const birthdayStudents = (students || []).filter((s) => !s.archived && isBirthdayOn(s.dob, dateStr));
  const birthdayBanner = birthdayStudents.length > 0 && (
    <div style={{ background: `${T.gold}1f`, border: `1px solid ${T.gold}66`, borderRadius: 8, padding: "8px 12px", fontSize: 13.5, color: T.maroonDark, fontWeight: 600 }}>
      🎂 Birthday{birthdayStudents.length > 1 ? "s" : ""} today: {birthdayStudents.map((s) => s.name).join(", ")}
    </div>
  );

  if (dayClasses.length === 0) {
    return (
      <div className="grid gap-3 mt-2">
        {birthdayBanner}
        <p style={{ color: T.inkSoft }}>No classes scheduled on {dayName}s.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 mt-2">
      {birthdayBanner}
      {utilCounts && (
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 12, color: T.inkSoft, fontWeight: 600 }}>Today:</span>
          <UtilizationBadge counts={utilCounts} />
        </div>
      )}
      {dayClasses.map((c) => {
        const skip = skips.find((s) => s.class_id === c.id && s.date === dateStr);
        const alreadyRecorded = recordedByClassDate?.[`${c.id}|${dateStr}`];
        // Distinct from the "haven't renewed" warning below (that's about payment
        // status; this is about who's actually shown up as absent) — its own
        // color so the two read as separate concerns at a glance.
        const isLowAttendance = !skip && lowAttendanceRisk(c.id, dateStr);
        return (
          <div key={c.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${isLowAttendance ? T.maroon : T.line}`, borderRadius: 8, padding: 16 }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <span style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark }}>{c.label}</span>
                <span style={{ fontSize: 13, color: T.inkSoft, marginLeft: 8 }}>{formatTimeRange(c.time, c.end_time)}</span>
                {isLowAttendance && (
                  <span style={{ fontSize: 11, color: T.maroon, fontWeight: 700, marginLeft: 8 }}>⚠ Half or more marked absent</span>
                )}
                {!skip && atRiskBookings(c.id, dateStr) > 0 && (
                  <span style={{ fontSize: 11, color: T.terracotta, fontWeight: 600, marginLeft: 8 }}>⚠ {atRiskBookings(c.id, dateStr)} haven't renewed</span>
                )}
              </div>
              {skip ? (
                canCancelSession ? (
                  <button onClick={() => onUnskip(skip)} style={{ fontSize: 12, color: T.terracotta, padding: "4px 6px" }}>Skipped{skip.reason ? ` — ${skip.reason}` : ""} · Undo</button>
                ) : (
                  <span style={{ fontSize: 12, color: T.terracotta, padding: "4px 6px" }}>Skipped{skip.reason ? ` — ${skip.reason}` : ""}</span>
                )
              ) : alreadyRecorded ? (
                <span style={{ fontSize: 11, color: T.inkSoft }} title="Someone's already been marked attended or missed — this class already happened">Can't skip — attendance recorded</span>
              ) : canCancelSession ? (
                <button onClick={() => onSkip({ ...c, dateStr, bookedCount: enrollments.filter((e) => e.class_id === c.id && (!e.start_date || e.start_date <= dateStr)).length })} style={{ fontSize: 12, color: T.terracotta, padding: "4px 6px" }}>Skip this date</button>
              ) : null}
            </div>
            {skip ? (
              <p style={{ fontSize: 13, color: T.inkSoft }}>This class is skipped for this date — no attendance can be marked.</p>
            ) : (
              <RosterEditor cls={{ ...c, dateStr }} onChanged={onChanged} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Small compact "✓3 !1 ⊘2" summary — attended/missed/skipped counts for one date —
// dropped inline into a day cell or the day header, next to the existing booking
// info, instead of taking over the whole view.
function UtilizationBadge({ counts }) {
  if (!counts) return null;
  const { attended = 0, missed = 0, skipped = 0 } = counts;
  if (attended + missed + skipped === 0) return null;
  return (
    <span style={{ fontSize: 10.5, fontWeight: 600, whiteSpace: "nowrap" }}>
      {attended > 0 && <span style={{ color: T.sage, marginRight: 5 }}>✓{attended}</span>}
      {missed > 0 && <span style={{ color: T.terracotta, marginRight: 5 }}>!{missed}</span>}
      {skipped > 0 && <span style={{ color: T.gold }}>⊘{skipped}</span>}
    </span>
  );
}

export default function CalendarView({ access }) {
  const canCancelSession = access?.has ? access.has("studio_settings") : true;
  const [viewMode, setViewMode] = useState("day");
  const [anchor, setAnchor] = useState(new Date());
  const [classes, setClasses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [skips, setSkips] = useState([]);
  const [bookingClass, setBookingClass] = useState(null);
  const [skippingClass, setSkippingClass] = useState(null);
  const [confirmUnskip, setConfirmUnskip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [studentArchived, setStudentArchived] = useState({}); // { [studentId]: boolean }
  const [remainingByStudent, setRemainingByStudent] = useState({}); // { [studentId]: classes left on their package }
  const [students, setStudents] = useState([]); // for the day view's birthday banner

  const load = useCallback(async () => {
    setLoading(true);
    const [cRes, eRes, skRes, sRes, pRes] = await Promise.all([
      supabase.from("classes").select("*"),
      supabase.from("enrollments").select("id, class_id, student_id, start_date"),
      supabase.from("class_skips").select("*"),
      supabase.from("students").select("id, name, archived, dob"),
      supabase.from("student_package_summary").select("student_id, classes_total, classes_used"),
    ]);
    setClasses(cRes.data || []);
    setEnrollments(eRes.data || []);
    setSkips(skRes.data || []);
    setStudentArchived(Object.fromEntries((sRes.data || []).map((s) => [s.id, s.archived])));
    setStudents(sRes.data || []);
    setRemainingByStudent(Object.fromEntries((pRes.data || []).map((p) => [p.student_id, p.classes_total - p.classes_used])));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const unskip = async (id) => {
    await supabase.from("class_skips").delete().eq("id", id);
    setConfirmUnskip(null);
    load();
  };

  const today = new Date();
  const todayStr = localDateStr(today);
  const dates = datesForView(viewMode, anchor);

  // A booking is "at risk" if the student is archived, missing, or has no classes
  // left on their package — i.e. still occupying a spot in a class roster without
  // being an active, paid-up student. Surfaced as a warning right on the calendar
  // so it's visible before drilling into a class's roster.
  const isAtRisk = (studentId) => studentArchived[studentId] !== false || (remainingByStudent[studentId] ?? 0) <= 0;
  const atRiskBookings = (classId, dateStr) =>
    enrollments.filter((e) => e.class_id === classId && (!e.start_date || e.start_date <= dateStr) && isAtRisk(e.student_id)).length;
  const bookedCount = (classId, dateStr) =>
    enrollments.filter((e) => e.class_id === classId && (!e.start_date || e.start_date <= dateStr)).length;

  const [utilCounts, setUtilCounts] = useState({}); // { [dateStr]: { attended, missed, skipped } }
  const [recordedByClassDate, setRecordedByClassDate] = useState({}); // { [`${class_id}|${date}`]: true } if attended/missed already recorded
  const [absentByClassDate, setAbsentByClassDate] = useState({}); // { [`${class_id}|${date}`]: count of skipped+missed }
  useEffect(() => {
    if (dates.length === 0) return;
    const startStr = localDateStr(dates[0].date);
    const endStr = localDateStr(dates[dates.length - 1].date);
    supabase.from("attendance").select("date, status, class_id").gte("date", startStr).lte("date", endStr).then(({ data }) => {
      const map = {};
      const recorded = {};
      const absent = {};
      (data || []).forEach((a) => {
        const c = (map[a.date] ||= { attended: 0, missed: 0, skipped: 0 });
        if (a.status === "attended") c.attended++;
        else if (a.status === "missed") c.missed++;
        else if (a.status === "skipped") c.skipped++;
        if (a.status === "attended" || a.status === "missed") recorded[`${a.class_id}|${a.date}`] = true;
        if (a.status === "missed" || a.status === "skipped") absent[`${a.class_id}|${a.date}`] = (absent[`${a.class_id}|${a.date}`] || 0) + 1;
      });
      setUtilCounts(map);
      setRecordedByClassDate(recorded);
      setAbsentByClassDate(absent);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, anchor.getTime()]);
  const lowAttendanceRisk = (classId, dateStr) =>
    isLowAttendanceRisk(bookedCount(classId, dateStr), absentByClassDate[`${classId}|${dateStr}`] || 0);

  const isAnchorToday = viewMode === "day"
    ? localDateStr(anchor) === todayStr
    : localDateStr(dates[0].date) <= todayStr && todayStr <= localDateStr(dates[dates.length - 1].date);

  if (loading) return <p style={{ color: T.inkSoft }}>Loading…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setAnchor((a) => navAnchor(viewMode, a, -1))} style={{ color: T.maroon, fontSize: 16, flexShrink: 0 }}>←</button>
          <span style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, minWidth: 190, textAlign: "center", display: "inline-block" }}>{rangeLabel(viewMode, anchor, dates)}</span>
          <button onClick={() => setAnchor((a) => navAnchor(viewMode, a, 1))} style={{ color: T.maroon, fontSize: 16, flexShrink: 0 }}>→</button>
        </div>
        <div className="flex items-center gap-3">
          {!isAnchorToday && <button onClick={() => setAnchor(new Date())} style={{ fontSize: 12, color: T.inkSoft }}>Today</button>}
          <div className="flex gap-1" style={{ background: T.paper, borderRadius: 8, padding: 3 }}>
            {VIEW_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setViewMode(m.id)}
                style={{
                  fontSize: 12, padding: "5px 12px", borderRadius: 6,
                  background: viewMode === m.id ? "#fff" : "transparent",
                  color: viewMode === m.id ? T.maroonDark : T.inkSoft,
                  fontWeight: viewMode === m.id ? 600 : 400,
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {viewMode === "day" ? (
        <DayView date={anchor} classes={classes} skips={skips} enrollments={enrollments} onSkip={setSkippingClass} onUnskip={setConfirmUnskip} onChanged={load} utilCounts={utilCounts[localDateStr(anchor)]} recordedByClassDate={recordedByClassDate} atRiskBookings={atRiskBookings} lowAttendanceRisk={lowAttendanceRisk} canCancelSession={canCancelSession} students={students} />
      ) : (
        <div className="grid gap-2 grid-cols-3 md:grid-cols-6">
          {dates.map(({ date, inMonth }, i) => {
            const dateStr = localDateStr(date);
            const isToday = dateStr === todayStr;
            const dayName = DAYS[(date.getDay() + 6) % 7];
            const dayClasses = classes.filter((c) => c.day === dayName && isClassActiveOn(c, dateStr));
            const dimmed = viewMode === "month" && !inMonth;
            return (
              <div key={i} style={{ background: isToday ? `${T.gold}18` : "#fff", border: `1px solid ${isToday ? T.gold : T.line}`, borderRadius: 8, padding: 8, minHeight: 80, opacity: dimmed ? 0.4 : 1 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                  <button
                    type="button"
                    onClick={() => { setAnchor(new Date(date)); setViewMode("day"); }}
                    style={{ fontSize: 12, fontWeight: 600, color: isToday ? T.maroon : T.inkSoft, display: "block", textAlign: "left", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
                    title="View this day"
                  >
                    {viewMode === "month" ? date.getDate() : `${dayName.slice(0, 3)} ${date.getDate()}`}
                  </button>
                  <UtilizationBadge counts={utilCounts[dateStr]} />
                </div>
                {dayClasses.length === 0 && <div style={{ fontSize: 11, color: `${T.inkSoft}99` }}>—</div>}
                {dayClasses.map((c) => {
                  const skip = skips.find((s) => s.class_id === c.id && s.date === dateStr);
                  const bookedCount = enrollments.filter((e) => e.class_id === c.id && (!e.start_date || e.start_date <= dateStr)).length;
                  const atRiskCount = atRiskBookings(c.id, dateStr);
                  if (skip) {
                    return (
                      <div key={c.id} style={{ background: `${T.terracotta}12`, border: `1px dashed ${T.terracotta}55`, borderRadius: 6, padding: "5px 8px", marginBottom: 5 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: T.terracotta }}>{formatTimeRange(c.time, c.end_time)} {c.label} — Skipped</div>
                        {skip.reason && <div style={{ fontSize: 10, color: T.inkSoft }}>{skip.reason}</div>}
                        <button type="button" onClick={() => setConfirmUnskip(skip)} style={{ fontSize: 10, color: T.inkSoft, textDecoration: "underline", marginTop: 2 }}>Undo skip</button>
                      </div>
                    );
                  }
                  const isLowAttendance = lowAttendanceRisk(c.id, dateStr);
                  return (
                    <div key={c.id} style={{ background: isLowAttendance ? `${T.maroon}14` : T.paper, border: isLowAttendance ? `1px solid ${T.maroon}55` : "none", borderRadius: 6, padding: "5px 8px", marginBottom: 5 }}>
                      <button type="button" onClick={() => setBookingClass({ ...c, dateStr })} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: T.maroonDark }}>{formatTimeRange(c.time, c.end_time)} {c.label}</div>
                        <div style={{ fontSize: 10, color: T.inkSoft }}>
                          {bookedCount} booked
                          {atRiskCount > 0 && <span style={{ color: T.terracotta, fontWeight: 600 }}> · ⚠ {atRiskCount}</span>}
                        </div>
                        {/* Distinct color/wording from the "haven't renewed" risk
                            above — this is specifically about turnout (who's
                            actually shown up as absent), not payment status. */}
                        {isLowAttendance && <div style={{ fontSize: 10, color: T.maroon, fontWeight: 700 }}>⚠ Half+ absent</div>}
                      </button>
                      {recordedByClassDate[`${c.id}|${dateStr}`] ? (
                        <span style={{ fontSize: 10, color: T.inkSoft }} title="Attendance already recorded — this class already happened">Can't skip</span>
                      ) : canCancelSession ? (
                        <button type="button" onClick={() => setSkippingClass({ ...c, dateStr, bookedCount })} style={{ fontSize: 10, color: T.terracotta, marginTop: 2 }}>Skip this date</button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
      {classes.length === 0 && <p style={{ color: T.inkSoft, marginTop: 16 }}>No classes set up yet — add classes under the Classes tab first.</p>}

      {bookingClass && (
        <Modal title={`${bookingClass.label} — ${bookingClass.dateStr}`} onClose={() => setBookingClass(null)} wide>
          <RosterEditor cls={bookingClass} onChanged={load} />
        </Modal>
      )}
      {skippingClass && (
        <SkipModal cls={skippingClass} onClose={() => setSkippingClass(null)} onSaved={() => { setSkippingClass(null); load(); }} />
      )}
      {confirmUnskip && (
        <ConfirmModal
          title="Undo skip?"
          message="This class will run as normal on this date again."
          confirmLabel="Undo skip"
          onConfirm={() => unskip(confirmUnskip.id)}
          onCancel={() => setConfirmUnskip(null)}
        />
      )}
    </div>
  );
}
