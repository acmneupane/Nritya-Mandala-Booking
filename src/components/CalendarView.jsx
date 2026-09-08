import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Field, Modal, ConfirmModal } from "./ui";
import { isClassActiveOn, formatTimeRange } from "../lib/scheduling";
import { localDateStr } from "../lib/dates";
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

function RosterEditor({ cls, onChanged }) {
  const [students, setStudents] = useState([]);
  const [roster, setRoster] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [remainingByStudent, setRemainingByStudent] = useState({});
  const [addingStudent, setAddingStudent] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, eRes, aRes] = await Promise.all([
      supabase.from("students").select("id, name").eq("archived", false),
      supabase.from("enrollments").select("id, student_id").eq("class_id", cls.id),
      supabase.from("attendance").select("id, student_id, status").eq("class_id", cls.id).eq("date", cls.dateStr),
    ]);
    setStudents(sRes.data || []);
    setRoster(eRes.data || []);
    setAttendance(aRes.data || []);
    const rosterIds = (eRes.data || []).map((e) => e.student_id);
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
  const availableStudents = students.filter((s) => !roster.some((r) => r.student_id === s.id));

  const enroll = async () => {
    if (!addingStudent) return;
    await supabase.from("enrollments").insert({ student_id: addingStudent, class_id: cls.id });
    setAddingStudent("");
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

  if (loading) return <p style={{ color: T.inkSoft, fontSize: 13 }}>Loading…</p>;

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <select style={inputStyle} value={addingStudent} onChange={(e) => setAddingStudent(e.target.value)}>
          <option value="">Book a student into this class…</option>
          {availableStudents.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Btn onClick={enroll}>+ Book</Btn>
      </div>
      {roster.length === 0 && <p style={{ color: T.inkSoft, fontSize: 13 }}>No one booked into this class yet.</p>}
      <div className="grid gap-2">
        {roster.map((r) => {
          const student = studentById[r.student_id];
          if (!student) return null;
          const att = attendance.find((a) => a.student_id === student.id);
          const remaining = remainingByStudent[student.id] ?? 0;
          return (
            <div key={r.id} style={{ border: `1px solid ${T.line}`, borderRadius: 6, padding: "8px 10px" }} className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 13, color: T.ink }}>{student.name}</span>
                {remaining > 0 && <span style={{ fontSize: 11, color: T.sage }}>{remaining} left</span>}
              </div>
              <div className="flex items-center flex-wrap gap-2">
                <button onClick={() => setStatus(student.id, "attended")} title="Mark attended" style={{ fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 999, background: att?.status === "attended" ? `${T.sage}22` : "transparent", color: att?.status === "attended" ? T.sage : T.inkSoft }}>✓ Attended</button>
                <button onClick={() => setStatus(student.id, "skipped")} title="Excused — notified in advance, doesn't count as missed" style={{ fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 999, background: att?.status === "skipped" ? `${T.gold}22` : "transparent", color: att?.status === "skipped" ? T.gold : T.inkSoft }}>⊘ Skipped</button>
                <button onClick={() => setStatus(student.id, "missed")} title="Missed — unexpected no-show" style={{ fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 999, background: att?.status === "missed" ? `${T.terracotta}22` : "transparent", color: att?.status === "missed" ? T.terracotta : T.inkSoft }}>! Missed</button>
                <button onClick={() => unenroll(r.id)} title="Remove booking" style={{ color: T.terracotta, padding: "5px 8px" }}>✕</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SkipModal({ cls, onClose, onSaved }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
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
function DayView({ date, classes, skips, onSkip, onUnskip, onChanged }) {
  const dateStr = localDateStr(date);
  const dayName = DAYS[(date.getDay() + 6) % 7];
  const dayClasses = classes.filter((c) => c.day === dayName && isClassActiveOn(c, dateStr)).sort((a, b) => a.time.localeCompare(b.time));
  const [scanningClass, setScanningClass] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Looks up the scanned code, books the student into this class if they weren't
  // already (a walk-in), and marks them attended for today — all in one scan.
  const checkInByCode = async (cls, code) => {
    const { data: student } = await supabase.from("students").select("id, name").eq("code", code).eq("archived", false).maybeSingle();
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
    setRefreshTick((t) => t + 1);
    onChanged();
    return { ok: true, message: `Checked in: ${student.name}` };
  };

  if (dayClasses.length === 0) {
    return <p style={{ color: T.inkSoft, marginTop: 12 }}>No classes scheduled on {dayName}s.</p>;
  }

  return (
    <div className="grid gap-4 mt-2">
      {dayClasses.map((c) => {
        const skip = skips.find((s) => s.class_id === c.id && s.date === dateStr);
        return (
          <div key={c.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 16 }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <span style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark }}>{c.label}</span>
                <span style={{ fontSize: 13, color: T.inkSoft, marginLeft: 8 }}>{formatTimeRange(c.time, c.end_time)}</span>
              </div>
              {skip ? (
                <button onClick={() => onUnskip(skip)} style={{ fontSize: 12, color: T.terracotta, padding: "4px 6px" }}>Skipped{skip.reason ? ` — ${skip.reason}` : ""} · Undo</button>
              ) : (
                <button onClick={() => onSkip({ ...c, dateStr })} style={{ fontSize: 12, color: T.terracotta, padding: "4px 6px" }}>Skip this date</button>
              )}
            </div>
            {!skip && (
              <div className="mb-3">
                <button
                  onClick={() => setScanningClass({ ...c, dateStr })}
                  style={{ fontSize: 13, color: T.maroonDark, fontWeight: 600, background: `${T.gold}22`, border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "8px 14px" }}
                >
                  📷 Scan to check in
                </button>
              </div>
            )}
            {skip ? (
              <p style={{ fontSize: 13, color: T.inkSoft }}>This class is skipped for this date — no attendance can be marked.</p>
            ) : (
              <RosterEditor key={`${c.id}-${dateStr}-${refreshTick}`} cls={{ ...c, dateStr }} onChanged={onChanged} />
            )}
          </div>
        );
      })}
      {scanningClass && (
        <QrScanner
          title={`Scan for ${scanningClass.label}`}
          onDetected={(code) => checkInByCode(scanningClass, code)}
          onClose={() => setScanningClass(null)}
        />
      )}
    </div>
  );
}

export default function CalendarView() {
  const [viewMode, setViewMode] = useState("month");
  const [anchor, setAnchor] = useState(new Date());
  const [classes, setClasses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [skips, setSkips] = useState([]);
  const [bookingClass, setBookingClass] = useState(null);
  const [skippingClass, setSkippingClass] = useState(null);
  const [confirmUnskip, setConfirmUnskip] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [cRes, eRes, skRes] = await Promise.all([
      supabase.from("classes").select("*"),
      supabase.from("enrollments").select("id, class_id"),
      supabase.from("class_skips").select("*"),
    ]);
    setClasses(cRes.data || []);
    setEnrollments(eRes.data || []);
    setSkips(skRes.data || []);
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
  const isAnchorToday = viewMode === "day"
    ? localDateStr(anchor) === todayStr
    : localDateStr(dates[0].date) <= todayStr && todayStr <= localDateStr(dates[dates.length - 1].date);

  if (loading) return <p style={{ color: T.inkSoft }}>Loading…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setAnchor((a) => navAnchor(viewMode, a, -1))} style={{ color: T.maroon, fontSize: 16 }}>←</button>
          <span style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark }}>{rangeLabel(viewMode, anchor, dates)}</span>
          <button onClick={() => setAnchor((a) => navAnchor(viewMode, a, 1))} style={{ color: T.maroon, fontSize: 16 }}>→</button>
          {!isAnchorToday && <button onClick={() => setAnchor(new Date())} style={{ fontSize: 12, color: T.inkSoft, marginLeft: 6 }}>Today</button>}
        </div>
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

      {viewMode === "day" ? (
        <DayView date={anchor} classes={classes} skips={skips} onSkip={setSkippingClass} onUnskip={setConfirmUnskip} onChanged={load} />
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
                <button
                  type="button"
                  onClick={() => { setAnchor(new Date(date)); setViewMode("day"); }}
                  style={{ fontSize: 12, fontWeight: 600, color: isToday ? T.maroon : T.inkSoft, marginBottom: 6, display: "block", textAlign: "left", background: "transparent", border: "none", padding: 0, cursor: "pointer", width: "100%" }}
                  title="View this day"
                >
                  {viewMode === "month" ? date.getDate() : `${dayName.slice(0, 3)} ${date.getDate()}`}
                </button>
                {dayClasses.length === 0 && <div style={{ fontSize: 11, color: `${T.inkSoft}99` }}>—</div>}
                {dayClasses.map((c) => {
                  const skip = skips.find((s) => s.class_id === c.id && s.date === dateStr);
                  const bookedCount = enrollments.filter((e) => e.class_id === c.id).length;
                  if (skip) {
                    return (
                      <div key={c.id} style={{ background: `${T.terracotta}12`, border: `1px dashed ${T.terracotta}55`, borderRadius: 6, padding: "5px 8px", marginBottom: 5 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: T.terracotta }}>{formatTimeRange(c.time, c.end_time)} {c.label} — Skipped</div>
                        {skip.reason && <div style={{ fontSize: 10, color: T.inkSoft }}>{skip.reason}</div>}
                        <button type="button" onClick={() => setConfirmUnskip(skip)} style={{ fontSize: 10, color: T.inkSoft, textDecoration: "underline", marginTop: 2 }}>Undo skip</button>
                      </div>
                    );
                  }
                  return (
                    <div key={c.id} style={{ background: T.paper, borderRadius: 6, padding: "5px 8px", marginBottom: 5 }}>
                      <button type="button" onClick={() => setBookingClass({ ...c, dateStr })} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: T.maroonDark }}>{formatTimeRange(c.time, c.end_time)} {c.label}</div>
                        <div style={{ fontSize: 10, color: T.inkSoft }}>{bookedCount} booked</div>
                      </button>
                      <button type="button" onClick={() => setSkippingClass({ ...c, dateStr })} style={{ fontSize: 10, color: T.terracotta, marginTop: 2 }}>Skip this date</button>
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
