import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { LOGO_DATA_URI } from "../lib/logo";
import { Btn } from "./ui";
import { localDateStr } from "../lib/dates";
import { buildQrCardDataUrl } from "../lib/qrCard";
import { QrCanvas } from "./QrCode";
import { nextOccurrenceOf, formatTimeRange, isClassActiveOn } from "../lib/scheduling";
import { classesLabel } from "../lib/format";
import MarkAbsentModal from "./MarkAbsentModal";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function formatOrdinalDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const n = d.getDate();
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  const suffix = suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0];
  return `${n}${suffix} ${d.toLocaleDateString(undefined, { month: "long" })}, ${d.getFullYear()}`;
}

export default function ParentView({ student, onBack, onSwitchStudent }) {
  const [level, setLevel] = useState(null);
  const [allLevels, setAllLevels] = useState([]);
  const [classes, setClasses] = useState([]);
  const [history, setHistory] = useState([]);
  const [levelHistory, setLevelHistory] = useState([]);
  const [pkgSummary, setPkgSummary] = useState(null);
  const [siblings, setSiblings] = useState([]);
  const [familyPackages, setFamilyPackages] = useState([]);
  const [loadingReceipt, setLoadingReceipt] = useState(null);
  const [allClassesCount, setAllClassesCount] = useState(0);
  const [dueThreshold, setDueThreshold] = useState(2);
  const [activeNotices, setActiveNotices] = useState([]);
  const [skips, setSkips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cardDataUrl, setCardDataUrl] = useState(null);
  const [markingBusy, setMarkingBusy] = useState(null);
  const [markAbsentOpen, setMarkAbsentOpen] = useState(false);
  const [singleMarkAbsent, setSingleMarkAbsent] = useState(null);
  const [showQr, setShowQr] = useState(false);

  const today = new Date();
  const todayStr = localDateStr(today);
  const todayDayName = DAYS[(today.getDay() + 6) % 7];

  const load = async () => {
    setLoading(true);
    const [levelRes, allLevelsRes, enrollRes, historyRes, levelHistRes, pkgRes, familyRes, skipsRes, familyPkgsRes, allClassesRes, settingsRes, noticesRes] = await Promise.all([
      student.level_id ? supabase.from("levels").select("id, name").eq("id", student.level_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("levels").select("id, name, order_num").order("order_num"),
      supabase.from("enrollments").select("class_id, classes(id, label, day, time, end_time, start_date, end_date)").eq("student_id", student.id),
      supabase.from("attendance").select("id, class_id, date, status, reason").eq("student_id", student.id).order("date", { ascending: false }).limit(10),
      supabase.from("level_history").select("id, level_id, date, levels(name)").eq("student_id", student.id).order("date", { ascending: false }),
      supabase.from("student_package_summary").select("classes_total, classes_used").eq("student_id", student.id).maybeSingle(),
      supabase.rpc("get_family_students", { p_code: student.code }),
      supabase.from("class_skips").select("class_id, date"),
      supabase.rpc("get_family_packages", { p_code: student.code }),
      supabase.from("classes").select("id", { count: "exact", head: true }),
      supabase.from("settings").select("due_threshold").eq("id", 1).maybeSingle(),
      supabase.from("studio_notices").select("*").lte("start_date", localDateStr(new Date())).gte("end_date", localDateStr(new Date())).order("start_date"),
    ]);
    setLevel(levelRes.data);
    setAllLevels(allLevelsRes.data || []);
    setClasses((enrollRes.data || []).map((e) => e.classes).filter(Boolean));
    setHistory(historyRes.data || []);
    setLevelHistory(levelHistRes.data || []);
    setPkgSummary(pkgRes.data);
    setSiblings((familyRes.data || []).filter((s) => s.id !== student.id));
    setSkips(skipsRes.data || []);
    setFamilyPackages(familyPkgsRes.data || []);
    setAllClassesCount(allClassesRes.count || 0);
    setDueThreshold(settingsRes.data?.due_threshold ?? 2);
    setActiveNotices(noticesRes.data || []);
    setLoading(false);
  };

  const viewReceipt = async (packageId) => {
    setLoadingReceipt(packageId);
    try {
      const { data, error } = await supabase.functions.invoke("get-receipt-url", { body: { code: student.code, packageId } });
      if (error || !data?.ok) { alert("Couldn't load the screenshot."); return; }
      window.open(data.url, "_blank");
    } finally {
      setLoadingReceipt(null);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [student.id]);

  useEffect(() => {
    const qrText = `${window.location.origin}/parent?code=${encodeURIComponent(student.code)}`;
    buildQrCardDataUrl({ studentName: student.name, code: student.code, qrText }).then(setCardDataUrl);
  }, [student.id, student.code, student.name]);

  const todaysClasses = useMemo(
    () => classes.filter((c) => c.day === todayDayName && isClassActiveOn(c, todayStr) && !skips.some((s) => s.class_id === c.id && s.date === todayStr)),
    [classes, todayDayName, todayStr, skips]
  );
  const classById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes]);
  const remaining = pkgSummary ? pkgSummary.classes_total - pkgSummary.classes_used : 0;
  const lastAttended = history.find((h) => h.status === "attended");
  const recentLevelUp = levelHistory[0] && (Date.now() - new Date(levelHistory[0].date).getTime()) / 86400000 <= 14 ? levelHistory[0] : null;

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
        <div className="flex items-start justify-between">
          <div>
            <img src={LOGO_DATA_URI} alt="" style={{ width: 40, height: 40, borderRadius: "50%", marginBottom: 8 }} />
            <p style={{ fontSize: 12, color: T.gold, fontWeight: 600, marginBottom: 4 }}>Nritya Mandala</p>
            <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 30, color: T.maroonDark, marginBottom: 4 }}>{student.name}</h1>
          </div>
          <button
            onClick={() => setShowQr(true)}
            title="Tap to enlarge your QR code"
            style={{ flexShrink: 0, position: "relative", padding: 6, borderRadius: 12, border: `2px solid ${T.gold}`, background: "#fff", marginTop: 2, lineHeight: 0 }}
          >
            <QrCanvas text={`${window.location.origin}/parent?code=${encodeURIComponent(student.code)}`} size={72} />
            <span style={{ position: "absolute", bottom: -6, right: -6, width: 22, height: 22, borderRadius: "50%", background: T.gold, color: T.maroonDark, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>🔍</span>
          </button>
        </div>
        <p style={{ fontSize: 11, color: T.gold, textAlign: "right", fontWeight: 600, marginTop: -2, marginBottom: 4 }}>Tap QR code to enlarge</p>

        {activeNotices.map((n) => (
          <div key={n.id} style={{ background: T.gold, borderRadius: 10, padding: "14px 18px", marginBottom: 16, boxShadow: `0 2px 8px ${T.gold}55` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.maroonDark, letterSpacing: 0.6, marginBottom: 4, textTransform: "uppercase" }}>📣 Announcement</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.maroonDark, lineHeight: 1.4 }}>{n.message}</div>
          </div>
        ))}

        {allLevels.length > 0 && (
          <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
            <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 8 }}>Level Journey</h3>
            <div className="mb-2">
              <span style={{ fontSize: 13, fontWeight: 600, color: T.maroonDark }}>{level ? level.name : "Unassigned"}</span>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {allLevels.map((l, i) => {
                const currentIdx = level ? allLevels.findIndex((x) => x.id === level.id) : -1;
                const reached = currentIdx >= 0 && i <= currentIdx;
                return (
                  <div key={l.id} title={l.name} style={{ flex: 1, height: 8, borderRadius: 4, background: reached ? T.sage : T.line }} />
                );
              })}
            </div>
          </div>
        )}

        {recentLevelUp && (
          <div style={{ fontSize: 13, color: T.sage, fontWeight: 600, marginBottom: 14 }}>
            🎉 Moved up to {recentLevelUp.levels?.name || "a new level"} on {formatOrdinalDate(recentLevelUp.date)}
          </div>
        )}

        {lastAttended && (
          <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 14 }}>
            Last attended: <strong style={{ color: T.ink }}>{formatOrdinalDate(lastAttended.date)}</strong>
          </div>
        )}

        {overallNext && (
          <div style={{ background: "#fff", border: `2px solid ${T.sage}`, borderRadius: 10, padding: "18px 16px", marginBottom: 14, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 }}>NEXT CLASS</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.sage, marginBottom: 10 }}>
              {overallNext.occ.date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}, {formatTimeRange(overallNext.cls.time, overallNext.cls.end_time)}
            </div>
            <button
              onClick={() => setSingleMarkAbsent({ classId: overallNext.cls.id, day: overallNext.cls.day, time: overallNext.cls.time, endTime: overallNext.cls.end_time, date: overallNext.occ.date, dateStr: overallNext.occ.dateStr })}
              style={{ fontSize: 13, fontWeight: 500, color: T.terracotta, border: `1px solid ${T.terracotta}55`, borderRadius: 999, padding: "6px 14px", background: "#fff" }}
            >
              Mark absent for this class
            </button>
          </div>
        )}

        {pkgSummary && pkgSummary.classes_total > 0 ? (
          <div style={{ background: remaining > 0 ? `${T.sage}18` : `${T.terracotta}18`, border: `1px solid ${remaining > 0 ? T.sage : T.terracotta}55`, borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, fontWeight: 600, color: remaining > 0 ? T.sage : T.terracotta }} className="flex items-center justify-between flex-wrap gap-2">
            <span>{classesLabel(remaining)} remaining on your package</span>
            {remaining <= dueThreshold && (
              <a href={`/renew?code=${encodeURIComponent(student.code)}`} style={{ color: T.gold, textDecoration: "underline", fontSize: 12.5 }}>Renew now →</a>
            )}
          </div>
        ) : (
          <div style={{ background: `${T.gold}18`, border: `1px solid ${T.gold}55`, borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, fontWeight: 600, color: T.gold }}>
            Pending package payment and confirmation
          </div>
        )}

        {todaysClasses.length > 0 && (
          <div style={{ background: "#fff", border: `2px solid ${T.gold}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 10 }}>Today — {todayDayName}</h3>
            {todaysClasses.map((c) => {
              const checkedIn = history.some((h) => h.class_id === c.id && h.date === todayStr && h.status === "attended");
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${T.line}` }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{formatTimeRange(c.time, c.end_time)}</div>
                  {checkedIn && <span style={{ fontSize: 12, fontWeight: 600, color: T.sage }}>✓ Checked in</span>}
                </div>
              );
            })}
          </div>
        )}

        {showQr && (
          <div
            onClick={() => setShowQr(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          >
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 24, maxWidth: 320, width: "100%", textAlign: "center" }}>
              <div className="flex items-center justify-between mb-2">
                <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark }}>Your QR code</h3>
                <button onClick={() => setShowQr(false)} style={{ fontSize: 20, color: T.inkSoft, lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ border: `2px solid ${T.gold}`, borderRadius: 10, padding: 12, background: "#fff", display: "inline-block" }}>
                <QrCanvas text={`${window.location.origin}/parent?code=${encodeURIComponent(student.code)}`} size={200} />
              </div>
              <div style={{ marginTop: 14, background: `${T.gold}18`, border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "10px 20px" }}>
                <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 2 }}>Code</div>
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 26, letterSpacing: 4, fontWeight: 700, color: T.maroonDark }}>{student.code}</div>
              </div>
              {cardDataUrl && (
                <a href={cardDataUrl} download={`${student.name.replace(/\s+/g, "-")}-qr-card.png`} className="mt-4 block">
                  <Btn variant="ghost">Download QR code</Btn>
                </a>
              )}
            </div>
          </div>
        )}


        {familyPackages.length > 0 && (
          <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 10 }}>Payment History</h3>
            {Object.entries(
              familyPackages.reduce((groups, p) => {
                (groups[p.student_name] ||= []).push(p);
                return groups;
              }, {})
            ).map(([name, pkgs]) => (
              <div key={name} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.maroonDark, marginBottom: 4 }}>{name}</div>
                {pkgs.slice(0, 5).map((p) => (
                  <div key={p.package_id} style={{ borderTop: `1px solid ${T.line}`, padding: "6px 0" }}>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 13, color: T.ink }}>{p.tier_name ? `${p.tier_name} (${classesLabel(p.classes_total)})` : classesLabel(p.classes_total)} — {p.purchase_date}</span>
                      {p.amount != null && <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>${Number(p.amount).toFixed(2)}</span>}
                    </div>
                    <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: p.payment_confirmed ? T.sage : T.inkSoft, fontWeight: 600 }}>{p.payment_confirmed ? "Payment confirmed" : "Pending confirmation"}</span>
                      {p.has_receipt && (
                        <button onClick={() => viewReceipt(p.package_id)} disabled={loadingReceipt === p.package_id} style={{ fontSize: 11, color: T.gold, textDecoration: "underline" }}>
                          {loadingReceipt === p.package_id ? "Loading…" : "View screenshot"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {pkgs.length > 5 && <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>Showing the 5 most recent — contact the studio for older records.</p>}
              </div>
            ))}
          </div>
        )}

        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark }}>Weekly classes</h3>
            {classes.length > 0 && <Btn size="sm" variant="ghost" onClick={() => setMarkAbsentOpen(true)}>Mark upcoming absences</Btn>}
          </div>
          {classes.length === 0 && <p style={{ fontSize: 13, color: T.inkSoft }}>No classes booked yet — check with the studio.</p>}
          {classes.map((c) => {
            const occ = nextOccurrences[c.id];
            const alreadyAbsent = occ && history.some((h) => h.class_id === c.id && h.date === occ.dateStr && (h.status === "skipped" || (h.status === "missed" && h.reason)));
            return (
              <div key={c.id} style={{ padding: "10px 0", borderTop: `1px solid ${T.line}` }}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{c.day} · {formatTimeRange(c.time, c.end_time)}</div>
                  {alreadyAbsent && (
                    <button onClick={() => undoAbsent(c.id, occ.dateStr)} disabled={markingBusy === c.id} style={{ fontSize: 12, fontWeight: 600, color: T.gold }} title="Tap to undo">
                      ⊘ Marked absent for {occ.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · Undo
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {allClassesCount > 1 && (
            <a
              href={`/transfer?code=${encodeURIComponent(student.code)}`}
              style={{ display: "block", textAlign: "center", fontSize: 13, color: T.gold, textDecoration: "underline", marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.line}` }}
            >
              Request a class change
            </a>
          )}
        </div>

        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 10 }}>Recent attendance</h3>
          {history.length === 0 && <p style={{ fontSize: 13, color: T.inkSoft }}>No history yet.</p>}
          {history.map((h) => {
            const lateCancel = h.status === "missed" && h.reason;
            const label = h.status === "attended" ? "Attended" : h.status === "skipped" ? "Marked absent" : lateCancel ? "Late cancellation" : "Missed";
            const color = h.status === "attended" ? T.sage : h.status === "skipped" ? T.gold : T.terracotta;
            return (
              <div key={h.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderTop: `1px solid ${T.line}` }}>
                <span>{h.date}</span>
                <span style={{ color, fontWeight: 600 }}>{label}</span>
              </div>
            );
          })}
        </div>

        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, marginBottom: 16, textAlign: "center" }}>
          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 8 }}>Find us</h3>
          <p style={{ fontSize: 13, color: T.ink, marginBottom: 4 }}>70 Central Avenue, Oran Park</p>
          <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10 }}>Behind Oran Park Library — Sandown Room 1</p>
          <a href="https://maps.google.com/?q=70+Central+Avenue+Oran+Park+NSW" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: T.gold, fontWeight: 600, textDecoration: "underline" }}>Get directions</a>

          <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 14, paddingTop: 14 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: T.maroonDark, marginBottom: 6, letterSpacing: 0.3 }}>CONTACT DETAILS</h4>
            <p style={{ fontSize: 13, color: T.ink }}>
              Email: <a href="mailto:nrityamandala93@gmail.com" style={{ color: T.gold, fontWeight: 600, textDecoration: "underline" }}>nrityamandala93@gmail.com</a>
            </p>
          </div>
        </div>

        {siblings.length > 0 && (
          <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 10 }}>Other Students</h3>
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
      {markAbsentOpen && (
        <MarkAbsentModal
          student={student}
          classes={classes}
          skips={skips}
          remaining={pkgSummary ? pkgSummary.classes_total - pkgSummary.classes_used : null}
          onClose={() => setMarkAbsentOpen(false)}
          onDone={() => { setMarkAbsentOpen(false); load(); }}
        />
      )}
      {singleMarkAbsent && (
        <MarkAbsentModal
          student={student}
          classes={classes}
          skips={skips}
          lockTo={singleMarkAbsent}
          onClose={() => setSingleMarkAbsent(null)}
          onDone={() => { setSingleMarkAbsent(null); load(); }}
        />
      )}
    </div>
  );
}
