import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { localDateStr } from "../lib/dates";
import { isClassActiveOn, formatTimeRange, upcomingOccurrencesOf } from "../lib/scheduling";
import { isLowAttendanceRisk } from "../lib/attendance";
import QrScanner from "./QrScanner";
import { Modal } from "./ui";
import NoticeMessage from "./NoticeMessage";
import { noticeAudienceLabel } from "../lib/notices";
import { RosterEditor } from "./CalendarView";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// A student "goes quiet" when they're still booked in, still have classes left on
// their package (so it's not just a renewal-due situation, which is already
// surfaced elsewhere), but haven't actually attended in this many days — worth a
// staff member reaching out, rather than waiting for them to run out of classes.
const QUIET_CHURN_DAYS = 14;

export default function HomeView({ counts, onNavigate, access }) {
  const [todayClasses, setTodayClasses] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [notices, setNotices] = useState([]);
  const [quietChurn, setQuietChurn] = useState([]);
  const [unconfirmedPackages, setUnconfirmedPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanningClass, setScanningClass] = useState(null);
  const [bookingClass, setBookingClass] = useState(null);
  const todayStr = localDateStr(new Date());

  const load = () => {
    const today = new Date();
    const dayName = DAYS[(today.getDay() + 6) % 7];
    const weekEndStr = localDateStr(new Date(Date.now() + 6 * 86400000));
    const churnCutoffStr = localDateStr(new Date(Date.now() - QUIET_CHURN_DAYS * 86400000));
    // A wide-but-bounded lookback for "have they attended recently" — well past the
    // churn window itself so a student's most recent attendance is always caught,
    // without pulling a growing studio's entire attendance history every load.
    const historyStartStr = localDateStr(new Date(Date.now() - 120 * 86400000));

    Promise.all([
      supabase.from("classes").select("*"),
      supabase.from("enrollments").select("student_id, class_id, start_date"),
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
      // Quiet-churn detection inputs — active students, their package balance, and
      // recent attendance history (see below).
      supabase.from("students").select("id, name, code").eq("archived", false),
      supabase.from("student_package_summary").select("student_id, classes_total, classes_used"),
      supabase.from("attendance").select("student_id, date, status").gte("date", historyStartStr).lte("date", todayStr),
      // Packages entered but never actually ticked "payment confirmed" — easy to
      // enter in a hurry and forget to come back to, so surface them rather than
      // relying on someone noticing during a finance review.
      supabase.from("packages").select("id, amount, classes_total, purchase_date, tier_name, notes, students(name, code)").eq("payment_confirmed", false).order("purchase_date"),
    ]).then(([cRes, eRes, skRes, noticesRes, attRes, weekSkipsRes, weekAttRes, studentsRes, pkgRes, historyRes, unconfirmedRes]) => {
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

      // Quiet churn: still booked in, still have classes left, but haven't actually
      // attended in QUIET_CHURN_DAYS — and have been booked long enough that they've
      // genuinely had the chance to (so a student who joined yesterday isn't flagged).
      const pkgByStudent = Object.fromEntries((pkgRes.data || []).map((p) => [p.student_id, p]));
      const earliestStartByStudent = {};
      enrollments.forEach((e) => {
        const startStr = e.start_date || "0000-01-01"; // no start_date recorded = booked from the start
        if (!(e.student_id in earliestStartByStudent) || startStr < earliestStartByStudent[e.student_id]) {
          earliestStartByStudent[e.student_id] = startStr;
        }
      });
      const lastAttendedByStudent = {};
      (historyRes.data || []).forEach((a) => {
        if (a.status !== "attended") return;
        if (!lastAttendedByStudent[a.student_id] || a.date > lastAttendedByStudent[a.student_id]) {
          lastAttendedByStudent[a.student_id] = a.date;
        }
      });
      const enrolledStudentIds = new Set(enrollments.map((e) => e.student_id));
      const quiet = (studentsRes.data || [])
        .filter((s) => enrolledStudentIds.has(s.id))
        .filter((s) => earliestStartByStudent[s.id] <= churnCutoffStr)
        .map((s) => {
          const pkg = pkgByStudent[s.id];
          const remaining = pkg ? pkg.classes_total - pkg.classes_used : 0;
          const lastAttended = lastAttendedByStudent[s.id] || null;
          const daysSince = lastAttended ? Math.round((new Date(todayStr + "T00:00:00") - new Date(lastAttended + "T00:00:00")) / 86400000) : null;
          return { ...s, remaining, lastAttended, daysSince };
        })
        .filter((s) => s.remaining > 0 && (!s.lastAttended || s.lastAttended <= churnCutoffStr))
        .sort((a, b) => (a.lastAttended || "").localeCompare(b.lastAttended || ""));
      setQuietChurn(quiet);

      setUnconfirmedPackages(unconfirmedRes.data || []);

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
          <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, letterSpacing: 0.4, marginBottom: 2, textTransform: "uppercase" }}>
            Current Announcement <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, color: T.inkSoft }}>· {noticeAudienceLabel(n)}</span>
          </div>
          <NoticeMessage message={n.message} style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }} />
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

      {!loading && unconfirmedPackages.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark, marginBottom: 4 }}>💳 Not marked as paid ({unconfirmedPackages.length})</h3>
          <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10 }}>Packages on file where "Payment confirmed" was never ticked — easy to lose track of.</p>
          <div className="grid gap-2">
            {unconfirmedPackages.map((p) => (
              <button
                key={p.id}
                onClick={() => access.canAccessTab("students") && onNavigate("students")}
                style={{ textAlign: "left", background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${T.terracotta}`, borderRadius: 8, padding: "10px 14px", cursor: access.canAccessTab("students") ? "pointer" : "default" }}
                className="flex items-center justify-between gap-2"
              >
                <div>
                  <span style={{ fontFamily: "Fraunces, serif", fontSize: 15, color: T.maroonDark }}>{p.students?.name || "Unknown student"}</span>
                  <span style={{ fontSize: 12, color: T.gold, fontWeight: 700, marginLeft: 8 }}>{p.students?.code}</span>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                    {p.tier_name ? `${p.tier_name} — ` : ""}{p.classes_total} class{p.classes_total === 1 ? "" : "es"} · {p.purchase_date}
                    {p.notes && ` · ${p.notes}`}
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.terracotta }}>{p.amount != null ? `$${Number(p.amount).toFixed(2)}` : "—"}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && quietChurn.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark, marginBottom: 4 }}>🔕 Gone quiet ({quietChurn.length})</h3>
          <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10 }}>Still booked in with classes left, but haven't attended in {QUIET_CHURN_DAYS}+ days — might be worth a check-in.</p>
          <div className="grid gap-2">
            {quietChurn.map((s) => (
              <button
                key={s.id}
                onClick={() => access.canAccessTab("students") && onNavigate("students")}
                style={{ textAlign: "left", background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${T.terracotta}`, borderRadius: 8, padding: "10px 14px", cursor: access.canAccessTab("students") ? "pointer" : "default" }}
                className="flex items-center justify-between gap-2"
              >
                <div>
                  <span style={{ fontFamily: "Fraunces, serif", fontSize: 15, color: T.maroonDark }}>{s.name}</span>
                  <span style={{ fontSize: 12, color: T.gold, fontWeight: 700, marginLeft: 8 }}>{s.code}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 12, color: T.terracotta, fontWeight: 600 }}>
                    {s.daysSince == null ? "Never attended" : `${s.daysSince} days since last class`}
                  </span>
                  <span style={{ fontSize: 11, color: T.inkSoft }}>· {s.remaining} class{s.remaining === 1 ? "" : "es"} left</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

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
