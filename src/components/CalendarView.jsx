import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Modal } from "./ui";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function RosterEditor({ cls, onChanged }) {
  const [students, setStudents] = useState([]);
  const [roster, setRoster] = useState([]); // enrollments for this class
  const [attendance, setAttendance] = useState([]); // attendance rows for this class+date
  const [remainingByStudent, setRemainingByStudent] = useState({});
  const [addingStudent, setAddingStudent] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, eRes, aRes] = await Promise.all([
      supabase.from("students").select("id, name"),
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
  const markAttendance = async (studentId, status) => {
    const existing = attendance.find((a) => a.student_id === studentId);
    if (existing && existing.status === status) {
      // toggle off
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
            <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${T.line}`, borderRadius: 6, padding: "6px 10px" }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 13, color: T.ink }}>{student.name}</span>
                {remaining > 0 && <span style={{ fontSize: 11, color: T.sage }}>{remaining} left</span>}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => markAttendance(student.id, "attended")} title="Mark attended" style={{ fontSize: 12, fontWeight: 600, color: att?.status === "attended" ? T.sage : T.inkSoft }}>✓ Attended</button>
                <button onClick={() => markAttendance(student.id, "missed")} title="Mark missed" style={{ fontSize: 12, fontWeight: 600, color: att?.status === "missed" ? T.terracotta : T.inkSoft }}>! Missed</button>
                <button onClick={() => unenroll(r.id)} title="Remove booking" style={{ color: T.terracotta }}>✕</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarView() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [classes, setClasses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [bookingClass, setBookingClass] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [cRes, eRes] = await Promise.all([
      supabase.from("classes").select("*"),
      supabase.from("enrollments").select("id, class_id"),
    ]);
    setClasses(cRes.data || []);
    setEnrollments(eRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7);
  const weekDates = DAYS.map((_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  const sunday = weekDates[6];
  const todayStr = today.toISOString().slice(0, 10);

  if (loading) return <p style={{ color: T.inkSoft }}>Loading…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset((w) => w - 1)} style={{ color: T.maroon, fontSize: 16 }}>←</button>
          <span style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark }}>
            {monday.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {sunday.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
          <button onClick={() => setWeekOffset((w) => w + 1)} style={{ color: T.maroon, fontSize: 16 }}>→</button>
        </div>
        {weekOffset !== 0 && <button onClick={() => setWeekOffset(0)} style={{ fontSize: 12, color: T.inkSoft }}>Back to this week</button>}
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
        {weekDates.map((date, i) => {
          const dateStr = date.toISOString().slice(0, 10);
          const isToday = dateStr === todayStr;
          const dayClasses = classes.filter((c) => c.day === DAYS[i]);
          return (
            <div key={i} style={{ background: isToday ? `${T.gold}18` : "#fff", border: `1px solid ${isToday ? T.gold : T.line}`, borderRadius: 8, padding: 10, minHeight: 90 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: isToday ? T.maroon : T.inkSoft, marginBottom: 6 }}>{DAYS[i].slice(0, 3)} {date.getDate()}</div>
              {dayClasses.length === 0 && <div style={{ fontSize: 11, color: `${T.inkSoft}99` }}>—</div>}
              {dayClasses.map((c) => {
                const bookedCount = enrollments.filter((e) => e.class_id === c.id).length;
                return (
                  <button key={c.id} onClick={() => setBookingClass({ ...c, dateStr })} style={{ display: "block", width: "100%", textAlign: "left", background: T.paper, borderRadius: 6, padding: "5px 8px", marginBottom: 5, border: "none" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.maroonDark }}>{c.time} {c.label}</div>
                    <div style={{ fontSize: 11, color: T.inkSoft }}>{bookedCount} booked</div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      {classes.length === 0 && <p style={{ color: T.inkSoft, marginTop: 16 }}>No classes set up yet — add classes under the Classes tab first.</p>}

      {bookingClass && (
        <Modal title={`${bookingClass.label} — ${bookingClass.dateStr}`} onClose={() => setBookingClass(null)} wide>
          <RosterEditor cls={bookingClass} onChanged={load} />
        </Modal>
      )}
    </div>
  );
}
