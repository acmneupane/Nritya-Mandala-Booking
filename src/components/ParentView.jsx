import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { LOGO_DATA_URI } from "../lib/logo";
import { Btn } from "./ui";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function ParentView({ student, onBack }) {
  const [level, setLevel] = useState(null);
  const [classes, setClasses] = useState([]);
  const [history, setHistory] = useState([]);
  const [levelHistory, setLevelHistory] = useState([]);
  const [pkgSummary, setPkgSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const todayDayName = DAYS[(today.getDay() + 6) % 7];

  const load = async () => {
    setLoading(true);
    const [levelRes, enrollRes, historyRes, levelHistRes, pkgRes] = await Promise.all([
      student.level_id ? supabase.from("levels").select("id, name").eq("id", student.level_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("enrollments").select("class_id, classes(id, label, day, time)").eq("student_id", student.id),
      supabase.from("attendance").select("id, class_id, date, status").eq("student_id", student.id).order("date", { ascending: false }).limit(10),
      supabase.from("level_history").select("id, level_id, date, levels(name)").eq("student_id", student.id).order("date", { ascending: false }),
      supabase.from("student_package_summary").select("classes_total, classes_used").eq("student_id", student.id).maybeSingle(),
    ]);
    setLevel(levelRes.data);
    setClasses((enrollRes.data || []).map((e) => e.classes).filter(Boolean));
    setHistory(historyRes.data || []);
    setLevelHistory(levelHistRes.data || []);
    setPkgSummary(pkgRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [student.id]);

  const todaysClasses = useMemo(() => classes.filter((c) => c.day === todayDayName), [classes, todayDayName]);
  const classById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes]);
  const remaining = pkgSummary ? pkgSummary.classes_total - pkgSummary.classes_used : 0;

  const checkIn = async (classId) => {
    await supabase.from("attendance").insert({ student_id: student.id, class_id: classId, date: todayStr, status: "attended" });
    load();
  };
  const undoCheckIn = async (classId) => {
    await supabase.from("attendance").delete().eq("student_id", student.id).eq("class_id", classId).eq("date", todayStr);
    load();
  };

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft }}>Loading…</div>;

  return (
    <div style={{ minHeight: "100vh", background: T.ivory, fontFamily: "Inter, sans-serif", padding: "32px 16px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <img src={LOGO_DATA_URI} alt="" style={{ width: 40, height: 40, borderRadius: "50%", marginBottom: 8 }} />
        <p style={{ fontSize: 12, color: T.gold, fontWeight: 600, marginBottom: 4 }}>Nritya Mandala</p>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 30, color: T.maroonDark, marginBottom: 4 }}>{student.name}</h1>
        <div style={{ marginBottom: 20 }}>
          {level ? (
            <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, background: `${T.sage}22`, color: T.sage, fontWeight: 600 }}>{level.name}</span>
          ) : (
            <span style={{ fontSize: 12, color: T.inkSoft }}>Unassigned</span>
          )}
        </div>

        {pkgSummary && pkgSummary.classes_total > 0 && (
          <div style={{ background: remaining > 0 ? `${T.sage}18` : `${T.terracotta}18`, border: `1px solid ${remaining > 0 ? T.sage : T.terracotta}55`, borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, fontWeight: 600, color: remaining > 0 ? T.sage : T.terracotta }}>
            {remaining} class{remaining === 1 ? "" : "es"} remaining on your package
          </div>
        )}

        {todaysClasses.length > 0 && (
          <div style={{ background: "#fff", border: `2px solid ${T.gold}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 10 }}>Today — {todayDayName}</h3>
            {todaysClasses.map((c) => {
              const checkedIn = history.some((h) => h.class_id === c.id && h.date === todayStr && h.status === "attended");
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${T.line}` }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{c.time}</div>
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
          {classes.map((c) => (
            <div key={c.id} style={{ padding: "8px 0", borderTop: `1px solid ${T.line}` }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{c.day} · {c.time}</div>
              <div style={{ fontSize: 12, color: T.inkSoft }}>{c.label}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 10 }}>Recent attendance</h3>
          {history.length === 0 && <p style={{ fontSize: 13, color: T.inkSoft }}>No history yet.</p>}
          {history.map((h) => (
            <div key={h.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderTop: `1px solid ${T.line}` }}>
              <span>{h.date}{classById[h.class_id] ? ` · ${classById[h.class_id].label}` : ""}</span>
              <span style={{ color: h.status === "attended" ? T.sage : T.terracotta, fontWeight: 600 }}>{h.status === "attended" ? "Attended" : "Absent"}</span>
            </div>
          ))}
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

        <button onClick={onBack} style={{ fontSize: 12, color: T.inkSoft, textDecoration: "underline" }}>← Look up a different code</button>
      </div>
    </div>
  );
}
