import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { useLogoUrl } from "../lib/logo";
import { Btn } from "./ui";
import { localDateStr, formatShortDate } from "../lib/dates";
import { buildQrCardDataUrl } from "../lib/qrCard";
import { QrCanvas } from "./QrCode";
import { nextOccurrenceOf, upcomingOccurrencesOf, formatTimeRange, isClassActiveOn } from "../lib/scheduling";
import { classesLabel } from "../lib/format";
import { fetchOpenClasses } from "../lib/classAvailability";
import { attendanceStatusInfo, isSelfMarkedAbsence } from "../lib/attendance";
import MarkAbsentModal from "./MarkAbsentModal";
import MessageStudioModal from "./MessageStudioModal";
import { APP_ORIGIN } from "../lib/origins";

// Web Share API opens the device's native share sheet (WhatsApp, Messages, Mail,
// etc.) — supported on mobile Safari/Chrome, not reliably on desktop browsers. Falls
// back to a WhatsApp Web link there instead, so the button still does something
// useful everywhere rather than silently failing on desktop.
function shareReferral() {
  const text = "My kid loves dancing at Nritya Mandala! Check out their classes:";
  if (navigator.share) {
    navigator.share({ title: "Nritya Mandala", text, url: APP_ORIGIN }).catch(() => {});
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${APP_ORIGIN}`)}`, "_blank");
  }
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Shared card treatment for every white panel on the page — soft shadow instead
// of a flat border-only look, matching the public homepage's card styling.
const CARD = "bg-white rounded-2xl shadow-[0_2px_12px_-4px_rgba(36,27,21,0.08)]";

function formatOrdinalDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const n = d.getDate();
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  const suffix = suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0];
  return `${n}${suffix} ${d.toLocaleDateString(undefined, { month: "long" })}, ${d.getFullYear()}`;
}

export default function ParentView({ student, onBack, onSwitchStudent }) {
  const logoUrl = useLogoUrl();
  const [level, setLevel] = useState(null);
  const [allLevels, setAllLevels] = useState([]);
  const [classes, setClasses] = useState([]);
  const [history, setHistory] = useState([]);
  const [levelHistory, setLevelHistory] = useState([]);
  const [pkgSummary, setPkgSummary] = useState(null);
  const [siblings, setSiblings] = useState([]);
  const [familyPackages, setFamilyPackages] = useState([]);
  const [loadingReceipt, setLoadingReceipt] = useState(null);
  const [openClasses, setOpenClasses] = useState([]);
  const [dueThreshold, setDueThreshold] = useState(2);
  const [activeNotices, setActiveNotices] = useState([]);
  const [skips, setSkips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cardDataUrl, setCardDataUrl] = useState(null);
  const [markAbsentOpen, setMarkAbsentOpen] = useState(false);
  const [singleMarkAbsent, setSingleMarkAbsent] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [totalAttended, setTotalAttended] = useState(0);
  const [streakRows, setStreakRows] = useState([]);

  const today = new Date();
  const todayStr = localDateStr(today);
  const todayDayName = DAYS[(today.getDay() + 6) % 7];

  const load = async () => {
    setLoading(true);
    const [levelRes, allLevelsRes, enrollRes, historyRes, levelHistRes, pkgRes, familyRes, skipsRes, familyPkgsRes, openClassesRes, settingsRes, noticesRes, attendedCountRes, streakRowsRes] = await Promise.all([
      student.level_id ? supabase.from("levels").select("id, name").eq("id", student.level_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("levels").select("id, name, order_num").order("order_num"),
      supabase.from("enrollments").select("class_id, classes(id, label, day, time, end_time, start_date, end_date)").eq("student_id", student.id),
      supabase.from("attendance").select("id, class_id, date, status, reason").eq("student_id", student.id).order("date", { ascending: false }).limit(10),
      supabase.from("level_history").select("id, level_id, date, levels(name)").eq("student_id", student.id).order("date", { ascending: false }),
      supabase.from("student_package_summary").select("classes_total, classes_used").eq("student_id", student.id).maybeSingle(),
      supabase.rpc("get_family_students", { p_code: student.code }),
      supabase.from("class_skips").select("class_id, date"),
      supabase.rpc("get_family_packages", { p_code: student.code }),
      fetchOpenClasses(),
      supabase.from("admin_settings").select("due_threshold").eq("id", 1).maybeSingle(),
      supabase.from("studio_notices").select("*").lte("start_date", localDateStr(new Date())).gte("end_date", localDateStr(new Date())).order("start_date"),
      // Milestones use their own dedicated queries rather than reusing `history`
      // (capped at 10 for the "recent attendance" list above) — a lifetime count
      // needs an exact aggregate, and a streak can run longer than 10 classes.
      supabase.from("attendance").select("id", { count: "exact", head: true }).eq("student_id", student.id).eq("status", "attended"),
      supabase.from("attendance").select("date, status").eq("student_id", student.id).lte("date", localDateStr(new Date())).order("date", { ascending: false }).limit(60),
    ]);
    setLevel(levelRes.data);
    setTotalAttended(attendedCountRes.count || 0);
    setStreakRows(streakRowsRes.data || []);
    setAllLevels(allLevelsRes.data || []);
    setClasses((enrollRes.data || []).map((e) => e.classes).filter(Boolean));
    setHistory(historyRes.data || []);
    setLevelHistory(levelHistRes.data || []);
    setPkgSummary(pkgRes.data);
    setSiblings((familyRes.data || []).filter((s) => s.id !== student.id));
    setSkips(skipsRes.data || []);
    setFamilyPackages(familyPkgsRes.data || []);
    setOpenClasses(openClassesRes);
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
    const qrText = `${APP_ORIGIN}/parent?code=${encodeURIComponent(student.code)}`;
    buildQrCardDataUrl({ studentName: student.name, code: student.code, qrText, logoUrl }).then(setCardDataUrl);
  }, [student.id, student.code, student.name, logoUrl]);

  const todaysClasses = useMemo(
    () => classes.filter((c) => c.day === todayDayName && isClassActiveOn(c, todayStr) && !skips.some((s) => s.class_id === c.id && s.date === todayStr)),
    [classes, todayDayName, todayStr, skips]
  );
  const classById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes]);
  const canTransfer = useMemo(() => openClasses.some((c) => !classes.some((cc) => cc.id === c.id)), [openClasses, classes]);
  const remaining = pkgSummary ? pkgSummary.classes_total - pkgSummary.classes_used : 0;
  // No active package yet (nothing paid/confirmed) — a booking can exist on the
  // class roster before that happens, but there's nothing to actually show up to
  // until it's confirmed, so next-class/today/weekly-classes all stay hidden.
  const hasActivePackage = !!(pkgSummary && pkgSummary.classes_total > 0);
  const lastAttended = history.find((h) => h.status === "attended");
  // Attendance history is past-only — an upcoming pre-marked absence has a future
  // date, so it'd otherwise sort to the top of "recent" (most recent date first)
  // and crowd out genuinely recent past entries.
  const pastHistory = history.filter((h) => h.date <= todayStr);
  const recentLevelUp = levelHistory[0] && (Date.now() - new Date(levelHistory[0].date).getTime()) / 86400000 <= 14 ? levelHistory[0] : null;

  // Consecutive attended classes counting back from most recent — breaks on the
  // first missed or self-marked-absent class encountered, same as everywhere
  // else "did they actually show up" is judged (attendanceStatusInfo).
  const attendanceStreak = useMemo(() => {
    let n = 0;
    for (const h of streakRows) {
      if (h.status !== "attended") break;
      n++;
    }
    return n;
  }, [streakRows]);
  const attendanceMilestone = totalAttended >= 5 ? Math.floor(totalAttended / 5) * 5 : null;

  // The literal next calendar occurrence per class, regardless of whether the
  // student has already marked it absent — this is what drives the "already
  // marked absent for <date> · Undo" affordance below, which needs to point at
  // the actual date they skipped.
  const nextOccurrences = useMemo(() => {
    const map = {};
    for (const c of classes) {
      const occ = nextOccurrenceOf(c, skips, localDateStr);
      if (occ) map[c.id] = occ;
    }
    return map;
  }, [classes, skips]);
  // The next occurrence the student is actually still expected to attend — skips
  // past any date they've already marked absent for themselves, so "Next Class"
  // doesn't keep showing a class they've said they'll miss.
  const upcomingAttendableOccurrences = useMemo(() => {
    const map = {};
    for (const c of classes) {
      const excludeDates = new Set(
        history.filter((h) => h.class_id === c.id && isSelfMarkedAbsence(h)).map((h) => h.date)
      );
      const occ = nextOccurrenceOf(c, skips, localDateStr, 60, excludeDates);
      if (occ) map[c.id] = occ;
    }
    return map;
  }, [classes, skips, history]);
  const overallNext = useMemo(() => {
    const entries = Object.entries(upcomingAttendableOccurrences).map(([classId, occ]) => ({ cls: classById[classId], occ }));
    entries.sort((a, b) => (a.occ.dateStr === b.occ.dateStr ? a.cls.time.localeCompare(b.cls.time) : a.occ.dateStr.localeCompare(b.occ.dateStr)));
    return entries[0] || null;
  }, [upcomingAttendableOccurrences, classById]);

  // Up to 10 occurrences across every class the student's booked into, each
  // annotated with its attendance status if one's already been recorded
  // (skipped/late-cancelled) — unlike overallNext/upcomingAttendableOccurrences,
  // this intentionally does NOT skip past self-marked absences, since the point
  // here is to show the family everything coming up, including what they've
  // already said they'll miss, not just what's left to attend.
  // Capped by their remaining package balance when it's lower than 10 — showing
  // "next 10" for someone with 3 classes left implies classes they haven't paid
  // for yet, which isn't accurate once their package runs out or they need to renew.
  const upcomingCap = Math.min(10, Math.max(0, remaining));
  const upcomingClasses = useMemo(() => {
    return classes
      .flatMap((c) => upcomingOccurrencesOf(c, skips, localDateStr, { count: upcomingCap }).map((occ) => ({ cls: c, occ })))
      .sort((a, b) => (a.occ.dateStr === b.occ.dateStr ? a.cls.time.localeCompare(b.cls.time) : a.occ.dateStr.localeCompare(b.occ.dateStr)))
      .slice(0, upcomingCap)
      .map((o) => ({ ...o, attendance: history.find((h) => h.class_id === o.cls.id && h.date === o.occ.dateStr) || null }));
  }, [classes, skips, history, upcomingCap]);

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft }}>Loading…</div>;

  return (
    <div style={{ minHeight: "100vh", background: T.ivory, fontFamily: "Inter, sans-serif" }} className="py-8 sm:py-14 px-4">
      <div className="max-w-[480px] sm:max-w-[620px] md:max-w-[760px] lg:max-w-[860px] mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <a href="/" className="hover:opacity-90 transition-opacity" style={{ display: "inline-block", marginBottom: 8 }}>
              <img src={logoUrl} alt="" style={{ width: 56, height: 56, borderRadius: "50%", display: "block" }} />
            </a>
            <p style={{ fontSize: 12, color: T.gold, fontWeight: 700, marginBottom: 4, letterSpacing: 0.3 }}>Nritya Mandala</p>
            <h1 className="font-serif text-3xl sm:text-4xl" style={{ fontFamily: "Fraunces, serif", color: T.maroonDark, fontWeight: 600 }}>{student.name}</h1>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <button
              onClick={() => setShowQr(true)}
              title="Tap to enlarge your QR code"
              className="hover:shadow-md transition-shadow"
              style={{ position: "relative", padding: 6, borderRadius: 14, border: `2px solid ${T.gold}`, background: "#fff", lineHeight: 0 }}
            >
              <QrCanvas text={`${APP_ORIGIN}/parent?code=${encodeURIComponent(student.code)}`} size={72} />
              <span style={{ position: "absolute", bottom: -6, right: -6, width: 22, height: 22, borderRadius: "50%", background: T.gold, color: T.maroonDark, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>🔍</span>
            </button>
            <button onClick={() => setShowQr(true)} style={{ fontSize: 11, color: T.gold, fontWeight: 600, marginTop: 10 }}>Tap QR code to enlarge</button>
          </div>
        </div>

        <div className="text-center" style={{ marginTop: 20, marginBottom: 4, fontSize: 11.5, color: T.inkSoft }}>
          <div>Enjoying your classes? Leave us a review:</div>
          <div className="flex items-center justify-center gap-2 flex-wrap" style={{ marginTop: 4 }}>
            <a href="https://g.page/r/Cd0RBuUBpA3jEBM/review" target="_blank" rel="noopener noreferrer" style={{ color: T.gold, fontWeight: 600, textDecoration: "underline" }}>Google</a>
            <span>·</span>
            <a href="https://www.facebook.com/profile.php?id=100095383322004" target="_blank" rel="noopener noreferrer" style={{ color: T.gold, fontWeight: 600, textDecoration: "underline" }}>Facebook</a>
            <span>·</span>
            <a href="https://www.tiktok.com/@nritya.mandala" target="_blank" rel="noopener noreferrer" style={{ color: T.gold, fontWeight: 600, textDecoration: "underline" }}>TikTok</a>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 flex-wrap" style={{ marginTop: 14 }}>
          <button
            onClick={shareReferral}
            className="hover:opacity-90 transition-opacity"
            style={{ fontSize: 12.5, fontWeight: 700, color: T.maroonDark, background: T.goldLight, border: `1px solid ${T.gold}`, borderRadius: 999, padding: "7px 16px" }}
          >
            📣 Refer a friend
          </button>
          <button
            onClick={() => setShowMessageModal(true)}
            className="hover:bg-white transition-colors"
            style={{ fontSize: 12.5, fontWeight: 600, color: T.maroon, background: "#fff", border: `1px solid ${T.maroon}44`, borderRadius: 999, padding: "7px 16px" }}
          >
            ✉️ Message the studio
          </button>
        </div>

        <div className="grid gap-4 mt-6">
          {activeNotices.map((n) => (
            <div key={n.id} className="rounded-2xl" style={{ background: T.gold, padding: "16px 20px", boxShadow: `0 8px 20px -6px ${T.gold}88` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.maroonDark, letterSpacing: 0.6, marginBottom: 4, textTransform: "uppercase" }}>📣 Announcement</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.maroonDark, lineHeight: 1.4 }}>{n.message}</div>
            </div>
          ))}

          {hasActivePackage && overallNext && (
            <div className="rounded-2xl flex items-center justify-center flex-wrap gap-3 text-center" style={{ background: "#f2f5f1", border: `1px solid ${T.sage}55`, padding: "14px 20px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.sage }}>
                Next class: {overallNext.occ.date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}, {formatTimeRange(overallNext.cls.time, overallNext.cls.end_time)}
              </div>
              <button
                onClick={() => setSingleMarkAbsent({ classId: overallNext.cls.id, day: overallNext.cls.day, time: overallNext.cls.time, endTime: overallNext.cls.end_time, date: overallNext.occ.date, dateStr: overallNext.occ.dateStr })}
                className="hover:bg-white transition-colors"
                style={{ fontSize: 13, fontWeight: 600, color: T.maroon, border: `1px solid ${T.maroon}44`, borderRadius: 999, padding: "8px 16px", background: "#fff", flexShrink: 0 }}
              >
                Mark absent
              </button>
            </div>
          )}

          {pkgSummary && pkgSummary.classes_total > 0 ? (
            <div className="rounded-2xl" style={{ background: remaining > 0 ? `${T.sage}18` : `${T.terracotta}18`, border: `1px solid ${remaining > 0 ? T.sage : T.terracotta}55`, padding: "16px 20px", fontSize: 13, fontWeight: 600, color: remaining > 0 ? T.sage : T.terracotta }}>
              <div style={{ marginBottom: 12, fontSize: 15, textAlign: "center" }}>{classesLabel(remaining)} remaining on your package</div>
              {remaining <= dueThreshold ? (
                <a
                  href={`/renew?code=${encodeURIComponent(student.code)}`}
                  className="block text-center hover:opacity-90 transition-opacity"
                  style={{ background: T.gold, color: T.maroonDark, fontWeight: 700, fontSize: 16, padding: "12px 20px", borderRadius: 999, textDecoration: "none" }}
                >
                  Renew now →
                </a>
              ) : (
                <a
                  href={`/renew?code=${encodeURIComponent(student.code)}`}
                  className="block text-center hover:bg-white transition-colors"
                  style={{ color: T.gold, border: `1px solid ${T.gold}66`, background: "#fff", fontWeight: 700, fontSize: 15, padding: "10px 20px", borderRadius: 999, textDecoration: "none" }}
                >
                  Renew
                </a>
              )}
            </div>
          ) : (
            <div className="rounded-2xl" style={{ background: `${T.gold}18`, border: `1px solid ${T.gold}55`, padding: "14px 20px", fontSize: 13, fontWeight: 600, color: T.gold }}>
              Pending package payment and confirmation
            </div>
          )}

          {allLevels.length > 0 && (
            <div className={CARD} style={{ padding: 20 }}>
              <h3 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark, marginBottom: 10 }}>Level Journey</h3>
              <div className="mb-3">
                <span style={{ fontSize: 13, fontWeight: 700, color: T.maroonDark }}>{level ? level.name : "Unassigned"}</span>
              </div>
              <div className="flex gap-2">
                {allLevels.map((l, i) => {
                  const currentIdx = level ? allLevels.findIndex((x) => x.id === level.id) : -1;
                  const reached = currentIdx >= 0 && i <= currentIdx;
                  return (
                    <div key={l.id} title={l.name} style={{ flex: 1, height: 8, borderRadius: 999, background: reached ? T.sage : T.paper }} />
                  );
                })}
              </div>
            </div>
          )}

          {(recentLevelUp || lastAttended || attendanceMilestone || attendanceStreak >= 3) && (
            <div className="flex flex-col gap-1.5 px-1">
              {recentLevelUp && (
                <div style={{ fontSize: 13, color: T.sage, fontWeight: 600 }}>
                  🎉 Moved up to {recentLevelUp.levels?.name || "a new level"} on {formatOrdinalDate(recentLevelUp.date)}
                </div>
              )}
              {attendanceMilestone && (
                <div style={{ fontSize: 13, color: T.gold, fontWeight: 600 }}>
                  🏅 {attendanceMilestone} classes attended!
                </div>
              )}
              {attendanceStreak >= 3 && (
                <div style={{ fontSize: 13, color: T.terracotta, fontWeight: 600 }}>
                  🔥 {attendanceStreak}-class attendance streak
                </div>
              )}
              {lastAttended && (
                <div style={{ fontSize: 13, color: T.inkSoft }}>
                  Last attended: <strong style={{ color: T.ink }}>{formatOrdinalDate(lastAttended.date)}</strong>
                </div>
              )}
            </div>
          )}

          {hasActivePackage && todaysClasses.length > 0 && (
            <div className="rounded-2xl" style={{ background: "#fff", border: `2px solid ${T.gold}`, padding: 20 }}>
              <h3 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark, marginBottom: 10 }}>Today — {todayDayName}</h3>
              {todaysClasses.map((c) => {
                const checkedIn = history.some((h) => h.class_id === c.id && h.date === todayStr && h.status === "attended");
                return (
                  <div key={c.id} className="flex items-center justify-between" style={{ padding: "10px 0", borderTop: `1px solid ${T.line}` }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{formatTimeRange(c.time, c.end_time)}</div>
                    {checkedIn && <span style={{ fontSize: 12, fontWeight: 600, color: T.sage }}>✓ Checked in</span>}
                  </div>
                );
              })}
            </div>
          )}

          {familyPackages.length > 0 && (
            <div className={CARD} style={{ padding: 20 }}>
              <h3 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark, marginBottom: 12 }}>Payment History</h3>
              {Object.entries(
                familyPackages.reduce((groups, p) => {
                  (groups[p.student_name] ||= []).push(p);
                  return groups;
                }, {})
              ).map(([name, pkgs]) => (
                <div key={name} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.maroonDark, marginBottom: 4 }}>{name}</div>
                  {pkgs.slice(0, 5).map((p) => (
                    <div key={p.package_id} style={{ borderTop: `1px solid ${T.line}`, padding: "8px 0" }}>
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

          {hasActivePackage && (
            <div className={CARD} style={{ padding: 20 }}>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <h3 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark }}>Weekly classes</h3>
                {classes.length > 0 && <Btn size="sm" variant="ghost" onClick={() => setMarkAbsentOpen(true)}>Mark upcoming absences</Btn>}
              </div>
              {classes.length === 0 && <p style={{ fontSize: 13, color: T.inkSoft }}>No classes booked yet — check with the studio.</p>}
              {classes.map((c) => {
                const occ = nextOccurrences[c.id];
                const alreadyAbsent = occ && history.some((h) => h.class_id === c.id && h.date === occ.dateStr && isSelfMarkedAbsence(h));
                return (
                  <div key={c.id} style={{ padding: "10px 0", borderTop: `1px solid ${T.line}` }}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{c.day} · {formatTimeRange(c.time, c.end_time)}</div>
                      {alreadyAbsent && (
                        // Undoing is intentionally admin-only (see undo_mark_absence's
                        // revoked anon/authenticated grants) — a parent can mark an
                        // absence but shouldn't be able to reverse it themselves,
                        // e.g. after the studio's already acted on it. Contact the
                        // studio directly to reverse one.
                        <span style={{ fontSize: 12, fontWeight: 600, color: T.gold }}>
                          ⊘ Marked absent for {occ.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {canTransfer && (
                <a
                  href={`${APP_ORIGIN}/transfer?code=${encodeURIComponent(student.code)}`}
                  style={{ display: "block", textAlign: "center", fontSize: 13, color: T.gold, textDecoration: "underline", marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.line}` }}
                >
                  Request a class change
                </a>
              )}
            </div>
          )}

          {hasActivePackage && upcomingClasses.length > 0 && (
            <div className={CARD} style={{ padding: 20 }}>
              <h3 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark, marginBottom: 12 }}>Upcoming classes</h3>
              {upcomingClasses.map((o, i) => {
                const info = o.attendance ? attendanceStatusInfo(o.attendance, T) : null;
                return (
                  <div key={i} className="flex items-center justify-between" style={{ fontSize: 13, padding: "7px 0", borderTop: `1px solid ${T.line}` }}>
                    <span style={{ color: T.ink }}>{formatShortDate(o.occ.dateStr)} · {o.cls.day} {formatTimeRange(o.cls.time, o.cls.end_time)}</span>
                    {/* No attendance record yet just means "not decided" — shown
                        plainly rather than implying anything's wrong. */}
                    {info ? <span style={{ color: info.color, fontWeight: 600 }}>{info.label}</span> : <span style={{ color: T.inkSoft }}>Upcoming</span>}
                  </div>
                );
              })}
            </div>
          )}

          <div className={CARD} style={{ padding: 20 }}>
            <h3 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark, marginBottom: 12 }}>Recent attendance</h3>
            {/* "Recent" means past — an upcoming date the parent has pre-marked
                absent isn't attendance history yet, and showing it here (sorted to
                the top, since it's the latest date) pushed genuinely recent past
                entries out of the list. It's already visible on the class's own
                row above via the "Marked absent for <date>" note. */}
            {pastHistory.length === 0 && <p style={{ fontSize: 13, color: T.inkSoft }}>No history yet.</p>}
            {pastHistory.map((h) => {
              const { label, color } = attendanceStatusInfo(h, T);
              return (
                <div key={h.id} className="flex items-center justify-between" style={{ fontSize: 13, padding: "7px 0", borderTop: `1px solid ${T.line}` }}>
                  <span>{new Date(h.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                  <span style={{ color, fontWeight: 600 }}>{label}</span>
                </div>
              );
            })}
          </div>

          <div className={`${CARD} text-center`} style={{ padding: 20 }}>
            <h3 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark, marginBottom: 10 }}>Find us</h3>
            <p style={{ fontSize: 13, color: T.ink, marginBottom: 4 }}>70 Central Avenue, Oran Park</p>
            <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 12 }}>Behind Oran Park Library — Sandown Room 1</p>
            <a href="https://maps.google.com/?q=70+Central+Avenue+Oran+Park+NSW" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: T.gold, fontWeight: 600, textDecoration: "underline" }}>Get directions</a>

            <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 16, paddingTop: 16 }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: T.maroonDark, marginBottom: 6, letterSpacing: 0.3 }}>CONTACT DETAILS</h4>
              <p style={{ fontSize: 13, color: T.ink }}>
                Email: <a href="mailto:nrityamandala93@gmail.com" style={{ color: T.gold, fontWeight: 600, textDecoration: "underline" }}>nrityamandala93@gmail.com</a>
              </p>
            </div>
          </div>

          {siblings.length > 0 && (
            <div className={CARD} style={{ padding: 20 }}>
              <h3 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark, marginBottom: 12 }}>Other Students</h3>
              <div className="grid gap-2">
                {siblings.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onSwitchStudent && onSwitchStudent(s)}
                    className="hover:bg-gray-50 transition-colors"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 14px", textAlign: "left" }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.maroonDark }}>{s.name}</span>
                    {s.guardian_names && <span style={{ fontSize: 11, color: T.inkSoft }}>{s.guardian_names}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="text-center" style={{ paddingTop: 20, paddingBottom: 24 }}>
          <button onClick={onBack} style={{ fontSize: 13, color: T.inkSoft }} className="hover:underline hover:text-gray-800">← Look up a different code</button>
        </div>
      </div>

      {showQr && (
        <div
          onClick={() => setShowQr(false)}
          className="backdrop-blur-sm"
          style={{ position: "fixed", inset: 0, background: "rgba(43,33,28,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} className="rounded-2xl shadow-xl" style={{ background: "#fff", padding: 28, maxWidth: 340, width: "100%", textAlign: "center" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 18, color: T.maroonDark }}>Your QR code</h3>
              <button onClick={() => setShowQr(false)} style={{ fontSize: 20, color: T.inkSoft, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ border: `3px solid ${T.gold}`, borderRadius: 14, padding: 14, background: "#fff", display: "inline-block" }}>
              <QrCanvas text={`${APP_ORIGIN}/parent?code=${encodeURIComponent(student.code)}`} size={200} />
            </div>
            <div style={{ marginTop: 18, background: `${T.gold}18`, border: `1px solid ${T.gold}55`, borderRadius: 12, padding: "12px 20px" }}>
              <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 2 }}>Code</div>
              <div className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 26, letterSpacing: 4, fontWeight: 700, color: T.maroonDark }}>{student.code}</div>
            </div>
            {cardDataUrl && (
              <a href={cardDataUrl} download={`${student.name.replace(/\s+/g, "-")}-qr-card.png`} className="mt-5 block">
                <Btn variant="ghost">Download QR code</Btn>
              </a>
            )}
          </div>
        </div>
      )}

      {markAbsentOpen && (
        <MarkAbsentModal
          student={student}
          classes={classes}
          skips={skips}
          history={history}
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
          history={history}
          lockTo={singleMarkAbsent}
          onClose={() => setSingleMarkAbsent(null)}
          onDone={() => { setSingleMarkAbsent(null); load(); }}
        />
      )}
      {showMessageModal && (
        <MessageStudioModal student={student} onClose={() => setShowMessageModal(false)} />
      )}
    </div>
  );
}
