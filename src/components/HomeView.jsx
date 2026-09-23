import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { localDateStr } from "../lib/dates";
import { isClassActiveOn, formatTimeRange, upcomingOccurrencesOf } from "../lib/scheduling";
import { isLowAttendanceRisk } from "../lib/attendance";
import QrScanner from "./QrScanner";
import { Modal } from "./ui";
import { RosterEditor } from "./CalendarView";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function HomeView({ counts, onNavigate, access }) {
  const [todayClasses, setTodayClasses] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanningClass, setScanningClass] = useState(null);
  const [bookingClass, setBookingClass] = useState(null);
  const todayStr = localDateStr(new Date());

  const load = () => {
    const today = new Date();
    const dayName = DAYS[(today.getDay() + 6) % 7];
    const weekEndStr = localDateStr(new Date(Date.now() + 6 * 86400000));

    Promise.all([
      supabase.from("classes").select("*"),
      supabase.from("enrollments").select("class_id, start_date"),
      supabase.from("class_skips").select("class_id, date").eq("date", todayStr),
      supabase.from("studio_notices").select("*").lte("start_date", todayStr).gte("end_date", todayStr).order("start_date"),
      // Who's already marked skipped/missed for today — used both to flag a
      // session where enough students have dropped out that turnout will be
      // sparse, and to name who specifically is out.
      supabase.from("attendance").select("class_id, status, students(name)").eq("date", todayStr),
      // Broader windows for the "next 7 days" projection below — occurrence
      // generation needs every skip in the window (not just today's), and the
      // estimate needs every already-marked absence in the window, with the
      // student's name so it can list who specifically is out.
      supabase.from("class_skips").select("class_id, date").gte("date", todayStr).lte("date", weekEndStr),
      supabase.from("attendance").select("class_id, date, status, students(name)").gte("date", todayStr).lte("date", weekEndStr).in("status", ["skipped", "missed"]),
    ]).then(([cRes, eRes, skRes, noticesRes, attRes, weekSkipsRes, weekAttRes]) => {
      const skippedIds = new Set((skRes.data || []).map((s) => s.class_id));
      const absenteesByClass = {};
      (attRes.data || []).forEach((a) => {
        if (a.status === "skipped" || a.status === "missed") (absenteesByClass[a.class_id] ||= []).push(a.students?.name);
      });
      const classes = (cRes.data || [])
        .filter((c) => c.day === dayName && isClassActiveOn(c, todayStr) && !skippedIds.has(c.id))
        .sort((a, b) => a.time.localeCompare(b.time))
        .map((c) => {
          const bookedCount = (eRes.data || []).filter((e) => e.class_id === c.id && (!e.start_date || e.start_date <= todayStr)).length;
          const absentees = (absenteesByClass[c.id] || []).filter(Boolean);
          return { ...c, bookedCount, absentees, lowAttendanceRisk: isLowAttendanceRisk(bookedCount, absentees.length) };
        });
      setTodayClasses(classes);
      setNotices(noticesRes.data || []);

      const enrollments = eRes.data || [];
      const weekSkips = weekSkipsRes.data || [];
      const weekAttendance = weekAttRes.data || [];
      const upcomingList = [];
      // Today is excluded — it's already covered by the "Today's classes" list above.
      (cRes.data || []).forEach((c) => {
        upcomingOccurrencesOf(c, weekSkips, localDateStr, { count: 20, lookaheadDays: 7, excludeDates: new Set([todayStr]) }).forEach((occ) => {
          const bookedCount = enrollments.filter((e) => e.class_id === c.id && (!e.start_date || e.start_date <= occ.dateStr)).length;
          const absentRows = weekAttendance.filter((a) => a.class_id === c.id && a.date === occ.dateStr);
          upcomingList.push({
            key: `${c.id}-${occ.dateStr}`,
            date: occ.date,
            dateStr: occ.dateStr,
            cls: c,
            bookedCount,
            estimatedAttending: Math.max(0, bookedCount - absentRows.length),
            absentees: absentRows.map((a) => a.students?.name).filter(Boolean),
            lowAttendanceRisk: isLowAttendanceRisk(bookedCount, absentRows.length),
          });
        });
      });
      upcomingList.sort((a, b) => (a.dateStr === b.dateStr ? a.cls.time.localeCompare(b.cls.time) : a.dateStr.localeCompare(b.dateStr)));
      setUpcoming(upcomingList);

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

  return (
    <div>
      <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.maroonDark, marginBottom: 4 }}>
        {new Date().toLocaleDateString(undefined, { timeZone: "Australia/Sydney", weekday: "long", month: "long", day: "numeric" })}
      </h2>
      <p style={{ fontSize: 13, color: T.inkSoft, marginBottom: 20 }}>Here's what's happening today, and what needs your attention.</p>

      {notices.map((n) => (
        <div key={n.id} style={{ background: `${T.gold}18`, border: `1px solid ${T.gold}55`, borderRadius: 10, padding: "10px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, letterSpacing: 0.4, marginBottom: 2, textTransform: "uppercase" }}>Current Announcement</div>
          <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }}>{n.message}</div>
        </div>
      ))}

      <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        {[
          { key: "requests", label: "NEW REQUESTS", accent: T.terracotta, count: counts.requests },
          { key: "renewals", label: "RENEWALS DUE / PENDING", accent: T.gold, count: counts.renewals },
          { key: "students", label: "ACTIVE STUDENTS", accent: T.sage, count: counts.students },
        ].map((tile) => {
          const clickable = access.canAccessTab(tile.key);
          return (
            <button
              key={tile.key}
              onClick={clickable ? () => onNavigate(tile.key) : undefined}
              disabled={!clickable}
              style={{
                textAlign: "left", background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${tile.accent}`,
                borderRadius: 10, padding: 16, cursor: clickable ? "pointer" : "default", opacity: clickable ? 1 : 0.7,
              }}
            >
              <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600 }}>{tile.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: T.maroonDark, fontFamily: "Fraunces, serif" }}>{tile.count}</div>
            </button>
          );
        })}
      </div>

      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark, marginBottom: 10 }}>Today's classes</h3>
      {loading ? (
        <p style={{ color: T.inkSoft }}>Loading…</p>
      ) : todayClasses.length === 0 ? (
        <p style={{ color: T.inkSoft }}>No classes scheduled today.</p>
      ) : (
        <div className="grid gap-2">
          {todayClasses.map((c) => (
            <div key={c.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${c.lowAttendanceRisk ? T.maroon : T.line}`, borderRadius: 8, padding: "10px 14px" }} className="flex items-center justify-between gap-2">
              <button onClick={() => setBookingClass({ ...c, dateStr: todayStr })} style={{ textAlign: "left", background: "transparent", border: "none", flex: 1, minWidth: 0, cursor: "pointer" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <span style={{ fontFamily: "Fraunces, serif", fontSize: 15, color: T.maroonDark }}>{c.label}</span>
                    <span style={{ fontSize: 12, color: T.inkSoft, marginLeft: 8 }}>{formatTimeRange(c.time, c.end_time)}</span>
                    {c.lowAttendanceRisk && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: T.maroon, marginLeft: 8 }}>⚠ Half or more absent</span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: T.inkSoft }}>{c.bookedCount} booked</span>
                </div>
                {c.absentees.length > 0 && (
                  <div style={{ fontSize: 11, color: T.terracotta, marginTop: 4 }}>Marked absent: {c.absentees.join(", ")}</div>
                )}
              </button>
              <button onClick={() => setScanningClass(c)} title="Scan to check in" style={{ fontSize: 15, padding: "4px 6px", background: "transparent", border: "none", cursor: "pointer", flexShrink: 0 }}>📷</button>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark, marginTop: 24, marginBottom: 10 }}>Next 7 days — estimated attendance</h3>
      {loading ? (
        <p style={{ color: T.inkSoft }}>Loading…</p>
      ) : upcoming.length === 0 ? (
        <p style={{ color: T.inkSoft }}>No classes scheduled in the next 7 days.</p>
      ) : (
        <div className="grid gap-2">
          {upcoming.map((o) => (
            <button
              key={o.key}
              onClick={() => onNavigate("calendar")}
              style={{ textAlign: "left", background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${o.lowAttendanceRisk ? T.maroon : T.line}`, borderRadius: 8, padding: "10px 14px", cursor: "pointer" }}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span style={{ fontSize: 12, color: T.inkSoft, fontWeight: 600 }}>{o.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                  <span style={{ fontFamily: "Fraunces, serif", fontSize: 15, color: T.maroonDark, marginLeft: 8 }}>{o.cls.label}</span>
                  <span style={{ fontSize: 12, color: T.inkSoft, marginLeft: 8 }}>{formatTimeRange(o.cls.time, o.cls.end_time)}</span>
                  {o.lowAttendanceRisk && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.maroon, marginLeft: 8 }}>⚠ Half or more absent</span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: T.inkSoft }}>{o.estimatedAttending} of {o.bookedCount} expected</span>
              </div>
              {o.absentees.length > 0 && (
                <div style={{ fontSize: 11, color: T.terracotta, marginTop: 4 }}>Marked absent: {o.absentees.join(", ")}</div>
              )}
            </button>
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
      {bookingClass && (
        <Modal title={`${bookingClass.label} — ${bookingClass.dateStr}`} onClose={() => setBookingClass(null)} wide>
          <RosterEditor cls={bookingClass} onChanged={load} />
        </Modal>
      )}
    </div>
  );
}
