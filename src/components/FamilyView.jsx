import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { useLogoUrl } from "../lib/logo";
import { localDateStr } from "../lib/dates";
import { nextOccurrenceOf, formatTimeRange } from "../lib/scheduling";
import { shareReferral } from "../lib/share";
import MessageStudioModal from "./MessageStudioModal";
import ReviewModal from "./ReviewModal";

// The family-summary landing screen for a multi-kid household — shown once,
// right after identity verification, instead of dropping straight into
// whichever child's code was used. Each row is a quick glance (next class,
// remaining classes or a renew-soon flag); tapping one opens that child's
// full ParentView, which offers a "Back to family" link to return here.
export default function FamilyView({ students, usedCode, onSelectStudent }) {
  const logoUrl = useLogoUrl();
  const [levels, setLevels] = useState([]);
  const [overviewByStudent, setOverviewByStudent] = useState({});
  const [loading, setLoading] = useState(true);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const usedStudent = students.find((s) => s.code === usedCode) || students[0];

  useEffect(() => {
    const load = async () => {
      const ids = students.map((s) => s.id);
      const [levelsRes, enrollRes, skipsRes, pkgRes, settingsRes] = await Promise.all([
        supabase.from("levels").select("id, name"),
        supabase.from("enrollments").select("student_id, classes(id, label, day, time, end_time, start_date, end_date)").in("student_id", ids),
        supabase.from("class_skips").select("class_id, date"),
        supabase.from("student_package_summary").select("student_id, classes_total, classes_used").in("student_id", ids),
        supabase.from("admin_settings").select("due_threshold").eq("id", 1).maybeSingle(),
      ]);
      setLevels(levelsRes.data || []);
      const dueThreshold = settingsRes.data?.due_threshold ?? 2;
      const skips = skipsRes.data || [];
      const classesByStudent = {};
      (enrollRes.data || []).forEach((e) => { if (e.classes) (classesByStudent[e.student_id] ||= []).push(e.classes); });
      const pkgByStudent = Object.fromEntries((pkgRes.data || []).map((p) => [p.student_id, p]));

      const overview = {};
      for (const s of students) {
        const pkg = pkgByStudent[s.id];
        const remaining = pkg ? pkg.classes_total - pkg.classes_used : 0;
        const nextOccs = (classesByStudent[s.id] || [])
          .map((c) => ({ cls: c, occ: nextOccurrenceOf(c, skips, localDateStr) }))
          .filter((o) => o.occ)
          .sort((a, b) => (a.occ.dateStr === b.occ.dateStr ? a.cls.time.localeCompare(b.cls.time) : a.occ.dateStr.localeCompare(b.occ.dateStr)));
        overview[s.id] = {
          remaining,
          dueSoon: remaining <= dueThreshold,
          nextLabel: nextOccs[0] ? `${nextOccs[0].occ.date.toLocaleDateString(undefined, { weekday: "short" })} ${formatTimeRange(nextOccs[0].cls.time, nextOccs[0].cls.end_time)}` : null,
        };
      }
      setOverviewByStudent(overview);
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const levelById = Object.fromEntries(levels.map((l) => [l.id, l.name]));

  return (
    <div style={{ minHeight: "100vh", background: T.ivory, fontFamily: "Inter, sans-serif" }} className="py-8 sm:py-14 px-4">
      <div className="max-w-[480px] mx-auto">
        <a href="/" className="hover:opacity-90 transition-opacity" style={{ display: "inline-block", marginBottom: 8 }}>
          <img src={logoUrl} alt="" style={{ width: 56, height: 56, borderRadius: "50%", display: "block" }} />
        </a>
        <p style={{ fontSize: 12, color: T.gold, fontWeight: 700, marginBottom: 4, letterSpacing: 0.3 }}>Nritya Mandala</p>
        <h1 className="font-serif text-3xl sm:text-4xl" style={{ fontFamily: "Fraunces, serif", color: T.maroonDark, fontWeight: 600 }}>Your family</h1>
        {usedStudent && (
          <p style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 4 }}>
            Showing everyone linked to the code you used for <strong style={{ color: T.ink }}>{usedStudent.name}</strong>
          </p>
        )}

        <div className="text-center" style={{ marginTop: 18, marginBottom: 4 }}>
          <button onClick={() => setShowReviewModal(true)} style={{ fontSize: 12.5, fontWeight: 600, color: T.gold }}>⭐ Leave us a review</button>
        </div>

        <div className="flex items-center justify-center gap-2 flex-wrap" style={{ marginTop: 14 }}>
          <button onClick={() => shareReferral(usedStudent?.code)} className="hover:opacity-90 transition-opacity" style={{ fontSize: 12.5, fontWeight: 700, color: T.maroonDark, background: T.goldLight, border: `1px solid ${T.gold}`, borderRadius: 999, padding: "7px 16px" }}>
            📣 Refer a friend
          </button>
          <button onClick={() => setShowMessageModal(true)} className="hover:opacity-90 transition-opacity" style={{ fontSize: 12.5, fontWeight: 700, color: T.maroonDark, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 999, padding: "7px 16px" }}>
            ✉️ Message the studio
          </button>
        </div>

        <div className="grid gap-2" style={{ marginTop: 18 }}>
          {loading ? (
            <p style={{ color: T.inkSoft, fontSize: 13 }}>Loading…</p>
          ) : (
            students.map((s) => {
              const o = overviewByStudent[s.id] || {};
              const isUsedCode = s.code === usedCode;
              return (
                <button
                  key={s.id}
                  onClick={() => onSelectStudent(s)}
                  className="hover:shadow-sm transition-shadow"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, textAlign: "left",
                    background: "#fff", borderRadius: 14, padding: "14px 16px",
                    border: isUsedCode ? `2px solid ${T.gold}` : `1px solid ${T.line}`,
                  }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span style={{ fontFamily: "Fraunces, serif", fontSize: 16, fontWeight: 600, color: T.maroonDark }}>{s.name}</span>
                      {isUsedCode && <span style={{ fontSize: 10, fontWeight: 700, color: T.maroonDark, background: T.goldLight, borderRadius: 999, padding: "2px 8px" }}>this code</span>}
                    </div>
                    <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 3 }}>
                      {levelById[s.level_id] || "Unassigned"}{o.nextLabel ? ` · Next: ${o.nextLabel}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {o.dueSoon ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: T.terracotta, background: `${T.terracotta}18`, borderRadius: 999, padding: "4px 10px" }}>⚠ Renew soon</span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, color: T.sage, background: `${T.sage}18`, borderRadius: 999, padding: "4px 10px" }}>{o.remaining} left</span>
                    )}
                    <span style={{ color: T.inkSoft }}>›</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <p style={{ fontSize: 12, color: T.inkSoft, textAlign: "center", marginTop: 14 }}>Tap a child to see their full details</p>
      </div>

      {showMessageModal && (
        <MessageStudioModal student={usedStudent} onClose={() => setShowMessageModal(false)} />
      )}
      {showReviewModal && <ReviewModal onClose={() => setShowReviewModal(false)} />}
    </div>
  );
}
