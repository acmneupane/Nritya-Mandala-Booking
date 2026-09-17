import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { localDateStr } from "../lib/dates";
import { isClassActiveOn, formatTimeRange } from "../lib/scheduling";
import QrScanner from "./QrScanner";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function HomeView({ counts, onNavigate }) {
  const [todayClasses, setTodayClasses] = useState([]);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanningClass, setScanningClass] = useState(null);
  const todayStr = localDateStr(new Date());

  const load = () => {
    const today = new Date();
    const dayName = DAYS[(today.getDay() + 6) % 7];

    Promise.all([
      supabase.from("classes").select("*"),
      supabase.from("enrollments").select("class_id, start_date"),
      supabase.from("class_skips").select("class_id, date").eq("date", todayStr),
      supabase.from("studio_notices").select("*").lte("start_date", todayStr).gte("end_date", todayStr).order("start_date"),
    ]).then(([cRes, eRes, skRes, noticesRes]) => {
      const skippedIds = new Set((skRes.data || []).map((s) => s.class_id));
      const classes = (cRes.data || [])
        .filter((c) => c.day === dayName && isClassActiveOn(c, todayStr) && !skippedIds.has(c.id))
        .sort((a, b) => a.time.localeCompare(b.time))
        .map((c) => ({
          ...c,
          bookedCount: (eRes.data || []).filter((e) => e.class_id === c.id && (!e.start_date || e.start_date <= todayStr)).length,
        }));
      setTodayClasses(classes);
      setNotices(noticesRes.data || []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  // Same check-in logic as the roster editor — looks up the scanned code, books the
  // student in if they weren't already (a walk-in), and marks them attended today.
  const checkInByCode = async (cls, code) => {
    const { data: student } = await supabase.from("students").select("id, name").eq("code", code).eq("archived", false).maybeSingle();
    if (!student) return { ok: false, message: "Code not recognized" };

    const { data: existingEnrollment } = await supabase.from("enrollments").select("id").eq("student_id", student.id).eq("class_id", cls.id).maybeSingle();
    if (!existingEnrollment) {
      await supabase.from("enrollments").insert({ student_id: student.id, class_id: cls.id, start_date: todayStr });
    }
    const { data: existingAttendance } = await supabase.from("attendance").select("id, status").eq("student_id", student.id).eq("class_id", cls.id).eq("date", todayStr).maybeSingle();
    if (existingAttendance) {
      if (existingAttendance.status !== "attended") await supabase.from("attendance").update({ status: "attended" }).eq("id", existingAttendance.id);
    } else {
      await supabase.from("attendance").insert({ student_id: student.id, class_id: cls.id, date: todayStr, status: "attended" });
    }
    load();
    return { ok: true, message: `${student.name} checked in ✓` };
  };

  const today = new Date();

  return (
    <div>
      <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.maroonDark, marginBottom: 4 }}>
        {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      </h2>
      <p style={{ fontSize: 13, color: T.inkSoft, marginBottom: 20 }}>Here's what's happening today, and what needs your attention.</p>

      {notices.map((n) => (
        <div key={n.id} style={{ background: `${T.gold}18`, border: `1px solid ${T.gold}55`, borderRadius: 10, padding: "10px 16px", marginBottom: 14, fontSize: 13, color: T.ink, lineHeight: 1.5 }}>
          📌 {n.message}
        </div>
      ))}

      <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <button onClick={() => onNavigate("requests")} style={{ textAlign: "left", background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${T.terracotta}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600 }}>NEW REQUESTS</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: T.maroonDark, fontFamily: "Fraunces, serif" }}>{counts.requests}</div>
        </button>
        <button onClick={() => onNavigate("renewals")} style={{ textAlign: "left", background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${T.gold}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600 }}>RENEWALS DUE / PENDING</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: T.maroonDark, fontFamily: "Fraunces, serif" }}>{counts.renewals}</div>
        </button>
        <button onClick={() => onNavigate("students")} style={{ textAlign: "left", background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${T.sage}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600 }}>ACTIVE STUDENTS</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: T.maroonDark, fontFamily: "Fraunces, serif" }}>{counts.students}</div>
        </button>
      </div>

      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark, marginBottom: 10 }}>Today's classes</h3>
      {loading ? (
        <p style={{ color: T.inkSoft }}>Loading…</p>
      ) : todayClasses.length === 0 ? (
        <p style={{ color: T.inkSoft }}>No classes scheduled today.</p>
      ) : (
        <div className="grid gap-2">
          {todayClasses.map((c) => (
            <div key={c.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: "10px 14px" }} className="flex items-center justify-between gap-2">
              <button onClick={() => onNavigate("calendar")} style={{ textAlign: "left", background: "transparent", border: "none", flex: 1, minWidth: 0, cursor: "pointer" }} className="flex items-center justify-between">
                <div>
                  <span style={{ fontFamily: "Fraunces, serif", fontSize: 15, color: T.maroonDark }}>{c.label}</span>
                  <span style={{ fontSize: 12, color: T.inkSoft, marginLeft: 8 }}>{formatTimeRange(c.time, c.end_time)}</span>
                </div>
                <span style={{ fontSize: 12, color: T.inkSoft }}>{c.bookedCount} booked</span>
              </button>
              <button onClick={() => setScanningClass(c)} title="Scan to check in" style={{ fontSize: 15, padding: "4px 6px", background: "transparent", border: "none", cursor: "pointer", flexShrink: 0 }}>📷</button>
            </div>
          ))}
        </div>
      )}
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
