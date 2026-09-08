import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { LOGO_DATA_URI } from "../lib/logo";
import { Btn } from "./ui";
import { localDateStr } from "../lib/dates";
import { buildQrCardDataUrl } from "../lib/qrCard";
import { QrCanvas } from "./QrCode";
import { nextOccurrenceOf, formatTimeRange } from "../lib/scheduling";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function ParentView({ student, onBack, onSwitchStudent }) {
  const [level, setLevel] = useState(null);
  const [classes, setClasses] = useState([]);
  const [history, setHistory] = useState([]);
  const [levelHistory, setLevelHistory] = useState([]);
  const [pkgSummary, setPkgSummary] = useState(null);
  const [siblings, setSiblings] = useState([]);
  const [skips, setSkips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cardDataUrl, setCardDataUrl] = useState(null);
  const [markingBusy, setMarkingBusy] = useState(null);

  const today = new Date();
  const todayStr = localDateStr(today);
  const todayDayName = DAYS[(today.getDay() + 6) % 7];

  const load = async () => {
    setLoading(true);
    const [levelRes, enrollRes, historyRes, levelHistRes, pkgRes, familyRes, skipsRes] = await Promise.all([
      student.level_id ? supabase.from("levels").select("id, name").eq("id", student.level_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("enrollments").select("class_id, classes(id, label, day, time, end_time, start_date, end_date)").eq("student_id", student.id),
      supabase.from("attendance").select("id, class_id, date, status").eq("student_id", student.id).order("date", { ascending: false }).limit(10),
      supabase.from("level_history").select("id, level_id, date, levels(name)").eq("student_id", student.id).order("date", { ascending: false }),
      supabase.from("student_package_summary").select("classes_total, classes_used").eq("student_id", student.id).maybeSingle(),
      supabase.rpc("get_family_students", { p_code: student.code }),
      supabase.from("class_skips").select("class_id, date"),
    ]);
    setLevel(levelRes.data);
    setClasses((enrollRes.data || []).map((e) => e.classes).filter(Boolean));
    setHistory(historyRes.data || []);
    setLevelHistory(levelHistRes.data || []);
    setPkgSummary(pkgRes.data);
    setSiblings((familyRes.data || []).filter((s) => s.id !== student.id));
    setSkips(skipsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [student.id]);

  useEffect(() => {
    const qrText = `${window.location.origin}/parent?code=${encodeURIComponent(student.code)}`;
    buildQrCardDataUrl({ studentName: student.name, code: student.code, qrText }).then(setCardDataUrl);
  }, [student.id, student.code, student.name]);

  const todaysClasses = useMemo(() => classes.filter((c) => c.day === todayDayName), [classes, todayDayName]);
  const classById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes]);
  const remaining = pkgSummary ? pkgSummary.classes_total - pkgSummary.classes_used : 0;

  const nextOccurrences = useMemo(() => {
    const map = {};
    for (const c of classes) {
      const occ = nextOccurrenceOf(c, skips, localDateStr);
      if (occ) map[c.id] = occ;
    }
    return map;
  }, [classes, skips]);
  const overallNext = useMemo(() => {
    const entries = Object.entries(nextOccurrences).map(([classId, occ]) => ({ cls: classById[classId], occ }));
    entries.sort((a, b) => (a.occ.dateStr === b.occ.dateStr ? a.cls.time.localeCompare(b.cls.time) : a.occ.dateStr.localeCompare(b.occ.dateStr)));
    return entries[0] || null;
  }, [nextOccurrences, classById]);

  const checkIn = async (classId) => {
    await supabase.from("attendance").insert({ student_id: student.id, class_id: classId, date: todayStr, status: "attended" });
    load();
  };
  const undoCheckIn = async (classId) => {
    await supabase.from("attendance").delete().eq("student_id", student.id).eq("class_id", classId).eq("date", todayStr);
    load();
  };
  const markAbsent = async (classId, dateStr) => {
    setMarkingBusy(classId);
    await supabase.rpc("mark_absence", { p_code: student.code, p_class_id: classId, p_date: dateStr });
    setMarkingBusy(null);
    load();
  };
  const undoAbsent = async (classId, dateStr) => {
    setMarkingBusy(classId);
    await supabase.rpc("undo_mark_absence", { p_code: student.code, p_class_id: classId, p_date: dateStr });
    setMarkingBusy(null);
    load();
  };

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft }}>Loading…</div>;

  return (
    <div style={{ minHeight: "100vh", background: T.ivory, fontFamily: "Inter, sans-serif", padding: "32px 16px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <img src={LOGO_DATA_URI} alt="" style={{ width: 40, height: 40, borderRadius: "50%", marginBottom: 8 }} />
        <p style={{ fontSize: 12, color: T.gold, fontWeight: 600, marginBottom: 4 }}>Nritya Mandala</p>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 30, color: T.maroonDark, marginBottom: 4 }}>{student.name}</h1>
        {level && (
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, background: `${T.sage}22`, color: T.sage, fontWeight: 600 }}>{level.name}</span>
          </div>
        )}

        {overallNext && (
          <div style={{ background: `${T.sage}18`, border: `1px solid ${T.sage}55`, borderRadius: 8, padding: "8px 14px", marginBottom: 14, fontSize: 13, fontWeight: 600, color: T.sage }}>
            Next class: {overallNext.cls.label} — {overallNext.occ.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}, {formatTimeRange(overallNext.cls.time, overallNext.cls.end_time)}
          </div>
        )}

        {pkgSummary && pkgSummary.classes_total > 0 && (
          <div style={{ background: remaining > 0 ? `${T.sage}18` : `${T.terracotta}18`, border: `1px solid ${remaining > 0 ? T.sage : T.terracotta}55`, borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, fontWeight: 600, color: remaining > 0 ? T.sage : T.terracotta }}>
            {remaining} class{remaining === 1 ? "" : "es"} remaining on your package
          </div>
        )}

        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, marginBottom: 16 }} className="flex flex-col items-center text-center">
          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 10 }}>Your QR code</h3>
          <div style={{ border: `2px solid ${T.gold}`, borderRadius: 10, padding: 12, background: "#fff" }}>
            <QrCanvas text={`${window.location.origin}/parent?code=${encodeURIComponent(student.code)}`} size={180} />
          </div>
          <div style={{ marginTop: 14, background: `${T.gold}18`, border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "10px 20px" }}>
            <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 2 }}>Code</div>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 26, letterSpacing: 4, fontWeight: 700, color: T.maroonDark }}>{student.code}</div>
          </div>
          {cardDataUrl && (
            <a href={cardDataUrl} download={`${student.name.replace(/\s+/g, "-")}-qr-card.png`} className="mt-4">
              <Btn variant="ghost">Download QR code</Btn>
            </a>
          )}
        </div>

        {todaysClasses.length > 0 && (
          <div style={{ background: "#fff", border: `2px solid ${T.gold}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 10 }}>Today — {todayDayName}</h3>
            {todaysClasses.map((c) => {
              const checkedIn = history.some((h) => h.class_id === c.id && h.date === todayStr && h.status === "attended");
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${T.line}` }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{formatTimeRange(c.time, c.end_time)}</div>
                    <div style={{ fontSize: 12, color: T.inkSoft }}>{c.label}</div>
                  </div>
                  {checkedIn ? (
                    <button onClick={() => undoCheckIn(c.id)} style={{ fontSize: 12, fontWeight: 600, color: T.sage }} title="Tap to undo">✓ Checked in</button>
                  ) : (
                    <Btn size="sm" onClick={() => checkIn(c.id)}>Check in</Btn>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 10 }}>Weekly classes</h3>
          {classes.length === 0 && <p style={{ fontSize: 13, color: T.inkSoft }}>No classes booked yet — check with the studio.</p>}
          {classes.map((c) => {
            const occ = nextOccurrences[c.id];
            const alreadyAbsent = occ && history.some((h) => h.class_id === c.id && h.date === occ.dateStr && h.status === "skipped");
            return (
              <div key={c.id} style={{ padding: "10px 0", borderTop: `1px solid ${T.line}` }}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{c.day} · {formatTimeRange(c.time, c.end_time)}</div>
                    <div style={{ fontSize: 12, color: T.inkSoft }}>{c.label}</div>
                  </div>
                  {occ && (
                    alreadyAbsent ? (
                      <button onClick={() => undoAbsent(c.id, occ.dateStr)} disabled={markingBusy === c.id} style={{ fontSize: 12, fontWeight: 600, color: T.gold }} title="Tap to undo">
                        ⊘ Marked absent for {occ.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · Undo
                      </button>
                    ) : (
                      <button onClick={() => markAbsent(c.id, occ.dateStr)} disabled={markingBusy === c.id} style={{ fontSize: 12, fontWeight: 600, color: T.terracotta, border: `1px solid ${T.terracotta}55`, borderRadius: 999, padding: "5px 12px", background: "#fff" }}>
                        {markingBusy === c.id ? "…" : `Mark absent for ${occ.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 10 }}>Recent attendance</h3>
          {history.length === 0 && <p style={{ fontSize: 13, color: T.inkSoft }}>No history yet.</p>}
          {history.map((h) => {
            const label = h.status === "attended" ? "Attended" : h.status === "skipped" ? "Marked absent" : "Missed";
            const color = h.status === "attended" ? T.sage : h.status === "skipped" ? T.gold : T.terracotta;
            return (
              <div key={h.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderTop: `1px solid ${T.line}` }}>
                <span>{h.date}{classById[h.class_id] ? ` · ${classById[h.class_id].label}` : ""}</span>
                <span style={{ color, fontWeight: 600 }}>{label}</span>
              </div>
            );
          })}
        </div>

        {levelHistory.length > 0 && (
          <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 10 }}>Level journey</h3>
            {levelHistory.map((h) => (
              <div key={h.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderTop: `1px solid ${T.line}` }}>
                <span>{h.levels?.name || "—"}</span>
                <span style={{ color: T.inkSoft }}>{h.date}</span>
              </div>
            ))}
          </div>
        )}

        {siblings.length > 0 && (
          <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 10 }}>Your Other Children</h3>
            <div className="grid gap-2">
              {siblings.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSwitchStudent && onSwitchStudent(s)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${T.line}`, borderRadius: 6, padding: "8px 10px", textAlign: "left" }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{s.name}</span>
                  {s.guardian_names && <span style={{ fontSize: 11, color: T.inkSoft }}>{s.guardian_names}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        <button onClick={onBack} style={{ fontSize: 12, color: T.inkSoft, textDecoration: "underline" }}>← Look up a different code</button>
      </div>
    </div>
  );
}
