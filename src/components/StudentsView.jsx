import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Field, Modal, TypeToConfirmModal, ConfirmModal } from "./ui";
import QrModal from "./QrCode";
import { classesLabel } from "../lib/format";
import { RELATION_OPTIONS } from "../lib/relations";
import { computeAge } from "../lib/age";
import { generateStudentCode } from "../lib/studentCode";
import { formatTimeRange, nextOccurrenceOf, upcomingOccurrencesOf, compareClassSchedule } from "../lib/scheduling";
import { localDateStr, formatSydneyDate, formatShortDate } from "../lib/dates";
import { attendanceStatusInfo } from "../lib/attendance";
import EmailPreviewModal from "./EmailPreviewModal";
import PendingPackagesEditor from "./PendingPackagesEditor";
import PackageReminderModal from "./PackageReminderModal";

const actionBtnStyle = { fontSize: 13, fontWeight: 500, padding: "5px 12px", borderRadius: 999, border: "1px solid", background: "#fff", whiteSpace: "nowrap" };

function daysAgo(isoDate) {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

// Labeled read-only row — shared shape for every field in StudentInfoModal so a
// glance at the JSX below reads as a list of facts, not a pile of repeated divs.
function InfoRow({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.inkSoft, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

// Full read-only profile for one student — everything from the edit form (but
// not editable here; use Edit for that), plus schedule and attendance context
// the edit form doesn't show: what class(es) they're in, their next class, their
// next 10 upcoming occurrences (each flagged with its recorded status, if any),
// and their last 10 past attendance records (attended/skipped/missed) — so an
// admin can answer "what's going on with this student" from one place instead
// of piecing it together across the Students list, Calendar, and package history.
function StudentInfoModal({ student, level, onClose }) {
  const [packages, setPackages] = useState([]);
  const [used, setUsed] = useState(0);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [otherGuardians, setOtherGuardians] = useState([]);
  const [enrolledClasses, setEnrolledClasses] = useState([]);
  const [skips, setSkips] = useState([]);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("packages").select("*").eq("student_id", student.id).order("purchase_date", { ascending: false }),
      supabase.from("student_package_summary").select("classes_used").eq("student_id", student.id).maybeSingle(),
      supabase.from("student_guardians").select("relation, emergency, guardians(name, phone, email)").eq("student_id", student.id),
      supabase.from("enrollments").select("classes(id, label, day, time, end_time, start_date, end_date)").eq("student_id", student.id),
      supabase.from("class_skips").select("class_id, date"),
      // Fetched unfiltered (past and future) since this one set of rows serves two
      // displays below: Recent attendance (past-only, filtered client-side) and
      // Next 10 upcoming classes' inline status lookup (needs future rows too).
      supabase.from("attendance").select("id, class_id, date, status, reason, classes(label)").eq("student_id", student.id).order("date", { ascending: false }).limit(10),
    ]).then(([pkgRes, summaryRes, guardiansRes, enrollRes, skipsRes, attRes]) => {
      setPackages(pkgRes.data || []);
      setUsed(summaryRes.data?.classes_used || 0);
      const all = guardiansRes.data || [];
      setEmergencyContacts(all.filter((g) => g.emergency));
      setOtherGuardians(all.filter((g) => !g.emergency));
      setEnrolledClasses((enrollRes.data || []).map((e) => e.classes).filter(Boolean));
      setSkips(skipsRes.data || []);
      setAttendanceRows(attRes.data || []);
      setLoading(false);
    });
  }, [student.id]);

  const purchased = packages.reduce((sum, p) => sum + p.classes_total, 0);
  const remaining = purchased - used;

  // Same "pool per class, merge chronologically" approach as MarkAbsentModal's
  // bulk picker — a student can be booked into more than one class, so their
  // next occurrences overall aren't just the next 10 of a single class. Capped
  // by their remaining package balance when it's lower than 10 — showing 10
  // upcoming classes for someone with 3 left implies classes they haven't paid
  // for yet, once their package runs out or they need to renew.
  const upcomingCap = Math.min(10, Math.max(0, remaining));
  const upcoming = enrolledClasses
    .flatMap((c) => upcomingOccurrencesOf(c, skips, localDateStr, { count: upcomingCap }).map((occ) => ({ cls: c, occ })))
    .sort((a, b) => a.occ.dateStr.localeCompare(b.occ.dateStr))
    .slice(0, upcomingCap);
  const nextClass = upcoming[0] || null;
  // "Recent attendance" is past-only — anything upcoming (including a pre-marked
  // absence) is already covered above, in Next 10 upcoming classes' inline status.
  const today = localDateStr(new Date());
  const recentAttendance = attendanceRows.filter((h) => h.date <= today);

  return (
    <Modal title={student.name} onClose={onClose} wide>
      {loading ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>
      ) : (
        <div className="grid gap-4">
          {student.archived && (
            <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, background: T.paper, borderRadius: 999, padding: "4px 10px", display: "inline-block", width: "fit-content" }}>ARCHIVED</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Date of birth">
              <span style={{ fontSize: 13, color: T.ink }}>
                {student.dob || "—"}{student.dob && computeAge(student.dob) != null ? ` (${computeAge(student.dob)}y)` : ""}
              </span>
            </InfoRow>
            <InfoRow label="Access code"><span style={{ fontSize: 13, color: T.ink, fontFamily: "monospace" }}>{student.code}</span></InfoRow>
            <InfoRow label="Level"><LevelBadge level={level} /></InfoRow>
            <InfoRow label="Photo/video consent"><ConsentBadge consent={student.video_consent} /></InfoRow>
          </div>

          <InfoRow label="Package">
            {purchased > 0 ? (
              <div style={{ fontSize: 13, color: T.ink }}>
                <strong>{purchased}</strong> purchased · <strong>{used}</strong> used ·{" "}
                <strong style={{ color: remaining > 0 ? T.sage : T.terracotta }}>{remaining}</strong> remaining
              </div>
            ) : (
              <span style={{ fontSize: 12, color: T.terracotta }}>No package on file</span>
            )}
          </InfoRow>

          <InfoRow label="Next class">
            {nextClass ? (
              <span style={{ fontSize: 13, color: T.ink }}>
                <strong>{formatShortDate(nextClass.occ.dateStr)}</strong> — {nextClass.cls.label} ({nextClass.cls.day} {formatTimeRange(nextClass.cls.time, nextClass.cls.end_time)})
              </span>
            ) : (
              <span style={{ fontSize: 12, color: T.terracotta }}>Not booked into a class</span>
            )}
          </InfoRow>

          {upcoming.length > 1 && (
            <InfoRow label="Next 10 upcoming classes">
              <div className="grid gap-1">
                {upcoming.map((o, i) => {
                  // Shows status inline where one's already been recorded (a
                  // parent pre-marking themselves absent) — same "Skipped /
                  // Missed / blank" idea as the parent portal's own Upcoming
                  // classes section, so admin sees the same picture.
                  const record = attendanceRows.find((h) => h.class_id === o.cls.id && h.date === o.occ.dateStr);
                  const info = record ? attendanceStatusInfo(record, T) : null;
                  return (
                    <div key={i} className="flex items-center justify-between" style={{ fontSize: 12.5 }}>
                      <span style={{ color: T.ink }}>{formatShortDate(o.occ.dateStr)} — {o.cls.label} ({o.cls.day} {formatTimeRange(o.cls.time, o.cls.end_time)})</span>
                      {info && <span style={{ color: info.color, fontWeight: 600, whiteSpace: "nowrap", marginLeft: 8 }}>{info.label}</span>}
                    </div>
                  );
                })}
              </div>
            </InfoRow>
          )}

          <InfoRow label="Recent attendance">
            {recentAttendance.length === 0 ? (
              <span style={{ fontSize: 12, color: T.inkSoft }}>No attendance recorded yet.</span>
            ) : (
              <div className="grid gap-1">
                {recentAttendance.map((h) => {
                  const { label: statusLabel, color } = attendanceStatusInfo(h, T);
                  return (
                    <div key={h.id} className="flex items-center justify-between" style={{ fontSize: 12.5 }}>
                      <span style={{ color: T.ink }}>{h.date} — {h.classes?.label || "—"}{h.reason ? ` (${h.reason})` : ""}</span>
                      <span style={{ color, fontWeight: 600, whiteSpace: "nowrap", marginLeft: 8 }}>{statusLabel}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </InfoRow>

          <InfoRow label="Emergency contacts">
            {emergencyContacts.length === 0 ? (
              <span style={{ fontSize: 12, color: T.terracotta }}>None on file</span>
            ) : (
              <div className="grid gap-1">
                {emergencyContacts.map((c, i) => (
                  <div key={i} style={{ fontSize: 13, color: T.ink }}>
                    <strong>{c.guardians?.name}</strong> ({c.relation}) · {c.guardians?.phone}{c.guardians?.email ? ` · ${c.guardians.email}` : ""}
                  </div>
                ))}
              </div>
            )}
          </InfoRow>

          {otherGuardians.length > 0 && (
            <InfoRow label="Other contacts">
              <div className="grid gap-1">
                {otherGuardians.map((c, i) => (
                  <div key={i} style={{ fontSize: 13, color: T.ink }}>
                    {c.guardians?.name} ({c.relation}) · {c.guardians?.phone}
                  </div>
                ))}
              </div>
            </InfoRow>
          )}

          {student.notes && (
            <InfoRow label="Notes">
              <div style={{ fontSize: 13, color: T.ink, whiteSpace: "pre-wrap" }}>{student.notes}</div>
            </InfoRow>
          )}
        </div>
      )}
      <div className="flex justify-end mt-4">
        <Btn variant="ghost" onClick={onClose}>Close</Btn>
      </div>
    </Modal>
  );
}

// Every badge gets its own icon and keeps the same pill shape whether it's showing
// real data or an empty state — that way admins tell fields apart by icon at a
// glance instead of having to read each one (an unassigned Level, an empty
// Package, and a Consent chip used to all read as similar muted grey pills).
function LevelBadge({ level }) {
  if (!level) return <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, background: `${T.inkSoft}18`, color: T.inkSoft, fontWeight: 600 }}>🎓 Unassigned</span>;
  return (
    <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, background: `${T.sage}22`, color: T.sage, fontWeight: 600 }}>🎓 {level.name}</span>
  );
}

// Defaults to the next level up in the ordered list, but lets the admin pick any
// level instead — e.g. skipping ahead, or correcting a mistake. Same effect as the
// promote dropdown in the Levels tab (updates the student + logs to level_history),
// just surfaced directly from the student's own card for convenience.
function UpgradeLevelModal({ student, levels, onClose, onUpgraded }) {
  const sorted = levels.slice().sort((a, b) => a.order_num - b.order_num);
  const currentIdx = sorted.findIndex((l) => l.id === student.level_id);
  const nextLevel = currentIdx >= 0 && currentIdx < sorted.length - 1 ? sorted[currentIdx + 1] : (currentIdx === -1 && sorted.length > 0 ? sorted[0] : null);
  const [levelId, setLevelId] = useState(nextLevel?.id || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!levelId) return;
    setSaving(true);
    await supabase.from("students").update({ level_id: levelId }).eq("id", student.id);
    await supabase.from("level_history").insert({ student_id: student.id, level_id: levelId, date: localDateStr(new Date()) });
    setSaving(false);
    onUpgraded();
  };

  const currentLevel = sorted.find((l) => l.id === student.level_id);

  return (
    <Modal title={`Upgrade ${student.name}'s level`} onClose={onClose}>
      <p style={{ fontSize: 13, color: T.inkSoft, marginBottom: 14 }}>Currently: {currentLevel ? currentLevel.name : "Unassigned"}</p>
      <Field label="New level">
        <select style={inputStyle} value={levelId} onChange={(e) => setLevelId(e.target.value)}>
          <option value="">Select…</option>
          {sorted.map((l) => <option key={l.id} value={l.id}>{l.name}{l.id === nextLevel?.id ? " (next)" : ""}</option>)}
        </select>
      </Field>
      <div className="flex justify-end gap-2 mt-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="success" onClick={save} disabled={saving || !levelId}>{saving ? "Updating…" : "Upgrade"}</Btn>
      </div>
    </Modal>
  );
}

// Small clickable stat tile — an at-a-glance count that doubles as a filter toggle,
// so "how many students need attention" is visible without opening any dropdown.
function StatChip({ icon, count, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 transition-colors"
      style={{
        border: `1px solid ${active ? T.gold : T.line}`,
        background: active ? `${T.gold}18` : "#fff",
        borderRadius: 10, padding: "8px 14px", textAlign: "left",
      }}
    >
      <span style={{ fontSize: 17 }}>{icon}</span>
      <span>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.maroonDark, lineHeight: 1 }}>{count}</div>
        <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2, whiteSpace: "nowrap" }}>{label}</div>
      </span>
    </button>
  );
}

function ConsentBadge({ consent }) {
  if (consent === true) return <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, background: `${T.sage}22`, color: T.sage, fontWeight: 600 }}>📷 Consent: Yes</span>;
  if (consent === false) return <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, background: `${T.terracotta}22`, color: T.terracotta, fontWeight: 600 }}>📷 Consent: No</span>;
  return <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, background: `${T.inkSoft}18`, color: T.inkSoft, fontWeight: 600 }}>📷 Consent: N/A</span>;
}

function PackageBadge({ remaining, hasAny }) {
  if (!hasAny) return <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 999, background: `${T.terracotta}18`, color: T.terracotta, fontWeight: 600 }}>📦 No package on file</span>;
  const ok = remaining > 0;
  return (
    <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 999, background: ok ? `${T.sage}18` : `${T.terracotta}18`, color: ok ? T.sage : T.terracotta, fontWeight: 600 }}>
      📦 {remaining} class{remaining === 1 ? "" : "es"} left
    </span>
  );
}

// Which class(es) a student is currently booked into, shown right on their card so
// "are they already in a class?" doesn't require opening Book class to find out.
function ClassBadge({ classes }) {
  if (!classes || classes.length === 0) return null;
  return (
    <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 999, background: `${T.gold}18`, color: T.maroonDark, fontWeight: 600 }}>
      📅 {classes.map((c) => `${c.day} ${formatTimeRange(c.time, c.end_time)}`).join(", ")}
    </span>
  );
}

// Packages purchased (classes bought + amount paid + a note) and a running remaining count.
// This is what tracks "how many classes has this student booked for, based on payment."
function PackagesSection({ studentId }) {
  const [packages, setPackages] = useState([]);
  const [receiptByPackage, setReceiptByPackage] = useState({});
  const [used, setUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [selectedTierId, setSelectedTierId] = useState("");
  const [classesTotal, setClassesTotal] = useState(10);
  const [amount, setAmount] = useState("");
  const [tierName, setTierName] = useState("");
  const [note, setNote] = useState("");
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [receiptFile, setReceiptFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadingReceipt, setLoadingReceipt] = useState(null); // package id currently signing a screenshot URL

  const load = useCallback(async () => {
    setLoading(true);
    const [pRes, sRes, tRes] = await Promise.all([
      supabase.from("packages").select("*").eq("student_id", studentId).order("purchase_date", { ascending: false }),
      supabase.from("student_package_summary").select("classes_used").eq("student_id", studentId).maybeSingle(),
      supabase.from("package_tiers").select("*").eq("active", true).order("sort_order"),
    ]);
    setPackages(pRes.data || []);
    setUsed(sRes.data?.classes_used || 0);
    setTiers(tRes.data || []);
    const ids = (pRes.data || []).map((p) => p.id);
    if (ids.length) {
      const { data: receiptRows } = await supabase.from("package_effective_receipts").select("*").in("package_id", ids);
      setReceiptByPackage(Object.fromEntries((receiptRows || []).map((r) => [r.package_id, r.receipt_path])));
    }
    setLoading(false);
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const viewReceipt = async (path, packageId) => {
    setLoadingReceipt(packageId);
    try {
      const { data, error } = await supabase.storage.from("payment-screenshots").createSignedUrl(path, 300);
      if (error || !data) { alert("Couldn't load the screenshot."); return; }
      window.open(data.signedUrl, "_blank");
    } finally {
      setLoadingReceipt(null);
    }
  };

  const total = packages.reduce((sum, p) => sum + p.classes_total, 0);
  const remaining = total - used;

  const resetForm = () => {
    setSelectedTierId(""); setClassesTotal(10); setAmount(""); setTierName(""); setNote(""); setPaymentConfirmed(false); setPaymentMethod(""); setReceiptFile(null);
  };

  const applyTier = (tierId) => {
    setSelectedTierId(tierId);
    const tier = tiers.find((t) => t.id === tierId);
    if (tier) { setClassesTotal(tier.classes_count); setAmount(String(tier.price)); setTierName(tier.name); }
  };

  const uploadReceiptIfAny = async () => {
    if (!receiptFile) return null;
    const ext = receiptFile.name.split(".").pop() || "png";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("payment-screenshots").upload(path, receiptFile);
    return error ? null : path;
  };

  const addPackage = async () => {
    if (!classesTotal || Number(classesTotal) <= 0) return;
    setSaving(true);
    const receiptPath = await uploadReceiptIfAny();
    await supabase.from("packages").insert({
      student_id: studentId,
      classes_total: Number(classesTotal),
      amount: amount ? Number(amount) : null,
      tier_name: tierName.trim() || null,
      notes: note.trim() || null,
      payment_confirmed: paymentConfirmed,
      payment_method: paymentConfirmed ? (paymentMethod || null) : null,
      receipt_path: receiptPath,
    });
    setSaving(false);
    setAdding(false);
    resetForm();
    load();
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setSelectedTierId("");
    setClassesTotal(p.classes_total);
    setAmount(p.amount != null ? String(p.amount) : "");
    setTierName(p.tier_name || "");
    setNote(p.notes || "");
    setPaymentConfirmed(p.payment_confirmed || false);
    setPaymentMethod(p.payment_method || "");
    setReceiptFile(null);
  };

  const saveEdit = async () => {
    if (!classesTotal || Number(classesTotal) <= 0) return;
    setSaving(true);
    const receiptPath = await uploadReceiptIfAny();
    const payload = {
      classes_total: Number(classesTotal),
      amount: amount ? Number(amount) : null,
      tier_name: tierName.trim() || null,
      notes: note.trim() || null,
      payment_confirmed: paymentConfirmed,
      payment_method: paymentConfirmed ? (paymentMethod || null) : null,
    };
    if (receiptPath) payload.receipt_path = receiptPath;
    await supabase.from("packages").update(payload).eq("id", editingId);
    setSaving(false);
    setEditingId(null);
    resetForm();
    load();
  };

  const removePackage = async (id) => {
    await supabase.from("packages").delete().eq("id", id);
    load();
  };

  const tierPicker = tiers.length > 0 && (
    <Field label="Package (optional — or enter custom below)">
      <select style={inputStyle} value={selectedTierId} onChange={(e) => applyTier(e.target.value)}>
        <option value="">Custom…</option>
        {tiers.map((t) => <option key={t.id} value={t.id}>{t.name} — {classesLabel(t.classes_count)} — ${Number(t.price).toFixed(2)}</option>)}
      </select>
    </Field>
  );

  const paymentMethodSelect = (
    <Field label="Payment method">
      <select style={inputStyle} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
        <option value="">Not specified</option>
        <option value="bank_transfer">Bank transfer</option>
        <option value="cash">Cash</option>
        <option value="card">Card</option>
        <option value="other">Other</option>
      </select>
    </Field>
  );

  if (loading) return <p style={{ fontSize: 12, color: T.inkSoft }}>Loading packages…</p>;

  return (
    <div className="mt-2 mb-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: T.inkSoft }}>Packages &amp; payments</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: remaining > 0 ? T.sage : T.terracotta }}>{remaining} of {total} class{total === 1 ? "" : "es"} remaining</span>
      </div>
      {packages.length === 0 && !adding && <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 8 }}>No packages on file yet.</p>}
      {packages.map((p) => (
        editingId === p.id ? (
          <div key={p.id} style={{ border: `1px solid ${T.gold}`, borderRadius: 8, padding: 10, marginBottom: 6 }}>
            {tierPicker}
            <Field label="Package name (shown to parents)"><input style={inputStyle} value={tierName} onChange={(e) => setTierName(e.target.value)} placeholder="e.g. पाँच कदम" /></Field>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Field label="Classes bought"><input style={inputStyle} type="number" min={1} value={classesTotal} onChange={(e) => setClassesTotal(e.target.value)} /></Field>
              <Field label="Amount paid ($)"><input style={inputStyle} type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            </div>
            <Field label="Internal notes (admin only, not shown to parents)"><input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            <label className="flex items-center gap-2 mb-2" style={{ fontSize: 12, color: T.ink, fontWeight: 500 }}>
              <input type="checkbox" checked={paymentConfirmed} onChange={(e) => setPaymentConfirmed(e.target.checked)} /> Payment confirmed
            </label>
            {paymentConfirmed && paymentMethodSelect}
            <Field label="Payment screenshot (optional)">
              <input type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
              {receiptByPackage[p.id] && !receiptFile && <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>A screenshot is already attached — choosing a new file will replace it.</p>}
            </Field>
            <div className="flex justify-end gap-2 mt-1">
              <Btn variant="ghost" size="sm" onClick={() => { setEditingId(null); resetForm(); }}>Cancel</Btn>
              <Btn size="sm" onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Btn>
            </div>
          </div>
        ) : (
          <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${T.line}`, borderRadius: 6, padding: "6px 10px", marginBottom: 6, fontSize: 12 }}>
            <div>
              <span style={{ fontWeight: 600 }}>{p.tier_name ? `${p.tier_name} — ` : ""}{classesLabel(p.classes_total)}</span>
              {p.amount != null && <span style={{ color: T.inkSoft, marginLeft: 6 }}>· ${Number(p.amount).toFixed(2)}</span>}
              <span style={{ color: T.inkSoft, marginLeft: 6 }}>· {p.purchase_date}</span>
              <span style={{ marginLeft: 6, color: p.payment_confirmed ? T.sage : T.terracotta, fontWeight: 600 }}>· {p.payment_confirmed ? "Confirmed" : "Unconfirmed"}</span>
              {receiptByPackage[p.id] && (
                <button onClick={() => viewReceipt(receiptByPackage[p.id], p.id)} disabled={loadingReceipt === p.id} style={{ marginLeft: 6, color: T.gold, textDecoration: "underline" }}>
                  {loadingReceipt === p.id ? "Loading…" : "View screenshot"}
                </button>
              )}
              {p.notes && <div style={{ color: T.inkSoft, marginTop: 2 }}><em>Internal note:</em> {p.notes}</div>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => startEdit(p)} style={{ color: T.maroon }}>Edit</button>
              <button onClick={() => removePackage(p.id)} style={{ color: T.terracotta }}>✕</button>
            </div>
          </div>
        )
      ))}
      {adding ? (
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 10, marginTop: 6 }}>
          {tierPicker}
          <Field label="Package name (shown to parents)"><input style={inputStyle} value={tierName} onChange={(e) => setTierName(e.target.value)} placeholder="e.g. पाँच कदम" /></Field>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Field label="Classes bought"><input style={inputStyle} type="number" min={1} value={classesTotal} onChange={(e) => setClassesTotal(e.target.value)} /></Field>
            <Field label="Amount paid ($)"><input style={inputStyle} type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 120.00" /></Field>
          </div>
          <Field label="Internal notes (admin only, not shown to parents)"><input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. paid cash, in two instalments" /></Field>
          <label className="flex items-center gap-2 mb-2" style={{ fontSize: 12, color: T.ink, fontWeight: 500 }}>
            <input type="checkbox" checked={paymentConfirmed} onChange={(e) => setPaymentConfirmed(e.target.checked)} /> Payment confirmed
          </label>
          {paymentConfirmed && paymentMethodSelect}
          <Field label="Payment screenshot (optional)">
            <input type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
          </Field>
          <div className="flex justify-end gap-2 mt-1">
            <Btn variant="ghost" size="sm" onClick={() => { setAdding(false); resetForm(); }}>Cancel</Btn>
            <Btn size="sm" onClick={addPackage} disabled={saving}>{saving ? "Saving…" : "Add package"}</Btn>
          </div>
        </div>
      ) : (
        <Btn size="sm" variant="ghost" onClick={() => setAdding(true)}>+ Add package</Btn>
      )}
    </div>
  );
}

function StudentModal({ initial, levels, allGuardians, onClose, onSaved }) {
  const [name, setName] = useState(initial?.name || "");
  const [dob, setDob] = useState(initial?.dob || "");
  const [levelId, setLevelId] = useState(initial?.level_id || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [code, setCode] = useState(initial?.code || "");
  const [videoConsent, setVideoConsent] = useState(initial && "video_consent" in initial ? (initial.video_consent === null ? "" : String(initial.video_consent)) : "");
  const [reminderOptOut, setReminderOptOut] = useState(initial?.renewal_reminder_opt_out || false);
  const [remindersEnabled, setRemindersEnabled] = useState(false);

  useEffect(() => {
    supabase.from("admin_settings").select("auto_renewal_reminders_enabled").eq("id", 1).maybeSingle().then(({ data }) => {
      setRemindersEnabled(!!data?.auto_renewal_reminders_enabled);
    });
  }, []);
  // Only used when creating a brand-new student — a package entered here gets saved
  // right after the student is created, since there's no student id to attach it to yet.
  const [pendingPackages, setPendingPackages] = useState([]);
  const [pendingPackagesDirty, setPendingPackagesDirty] = useState(false);
  const [confirmDirtyPackage, setConfirmDirtyPackage] = useState(false);
  const [links, setLinks] = useState([]); // {guardian_id, name, phone, email, relation, emergency}
  const [originalLinkIds, setOriginalLinkIds] = useState([]);
  const [guardianQuery, setGuardianQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [addingNote, setAddingNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [currentUserLabel, setCurrentUserLabel] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserLabel(data?.user?.user_metadata?.display_name || data?.user?.email || "Admin");
    });
  }, []);

  const addNote = () => {
    if (!newNoteText.trim()) return;
    const dateStr = formatSydneyDate(new Date());
    const entry = `${dateStr} by ${currentUserLabel}: ${newNoteText.trim()}`;
    setNotes((prev) => (prev && prev.trim() ? `${prev.trim()}\n${entry}` : entry));
    setNewNoteText("");
    setAddingNote(false);
  };

  const [regenerating, setRegenerating] = useState(false);
  const regenerateCode = async () => {
    setRegenerating(true);
    try {
      setCode(await generateStudentCode(supabase, name, initial?.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setRegenerating(false);
    }
  };

  useEffect(() => {
    if (!initial?.id) return;
    supabase
      .from("student_guardians")
      .select("id, guardian_id, relation, emergency, guardians(id, name, phone, email)")
      .eq("student_id", initial.id)
      .then(({ data }) => {
        setOriginalLinkIds((data || []).map((l) => l.id));
        setLinks((data || []).map((l) => ({
          linkId: l.id,
          guardianId: l.guardian_id,
          name: l.guardians?.name || "",
          phone: l.guardians?.phone || "",
          email: l.guardians?.email || "",
          relation: RELATION_OPTIONS.includes(l.relation) ? l.relation : "Other",
          relationOther: RELATION_OPTIONS.includes(l.relation) ? "" : l.relation,
          emergency: l.emergency,
        })));
      });
  }, [initial?.id]);

  const addNewGuardian = () => {
    setLinks((ls) => [...ls, { linkId: null, guardianId: null, name: "", phone: "", email: "", relation: "", relationOther: "", emergency: ls.length === 0, isNew: true }]);
  };
  const linkExistingGuardian = (g) => {
    if (links.some((l) => l.guardianId === g.id)) return;
    setLinks((ls) => [...ls, { linkId: null, guardianId: g.id, name: g.name, phone: g.phone, email: g.email || "", relation: "", relationOther: "", emergency: ls.length === 0, isExisting: true }]);
    setGuardianQuery("");
  };
  const updateLink = (i, field, val) => setLinks((ls) => ls.map((l, idx) => (idx === i ? { ...l, [field]: val } : l)));
  const removeLink = (i) => setLinks((ls) => ls.filter((_, idx) => idx !== i));

  const matches = guardianQuery.trim()
    ? allGuardians.filter((g) => g.name.toLowerCase().includes(guardianQuery.toLowerCase()) && !links.some((l) => l.guardianId === g.id))
    : [];

  const handleSaveClick = () => {
    if (!initial?.id && pendingPackagesDirty) {
      setConfirmDirtyPackage(true);
      return;
    }
    save();
  };

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      // Resolve the access code: use what's typed, or generate a name-based one if left blank.
      let finalCode = code.trim().toUpperCase();
      if (!finalCode) {
        finalCode = await generateStudentCode(supabase, name, initial?.id);
      } else {
        let clashQuery = supabase.from("students").select("id").eq("code", finalCode);
        if (initial?.id) clashQuery = clashQuery.neq("id", initial.id);
        const { data: clash } = await clashQuery.maybeSingle();
        if (clash) { setError(`Code "${finalCode}" is already in use by another student.`); setSaving(false); return; }
      }

      let studentId = initial?.id;
      const consentValue = videoConsent === "" ? null : videoConsent === "true";
      if (studentId) {
        const { error } = await supabase.from("students").update({
          name: name.trim(), dob: dob || null, level_id: levelId || null, notes: notes.trim(), code: finalCode, video_consent: consentValue,
          renewal_reminder_opt_out: reminderOptOut,
        }).eq("id", studentId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("students").insert({
          name: name.trim(), dob: dob || null, level_id: levelId || null, notes: notes.trim(), code: finalCode, video_consent: consentValue,
          renewal_reminder_opt_out: reminderOptOut,
        }).select().single();
        if (error) throw error;
        studentId = data.id;

        for (const p of pendingPackages) {
          await supabase.from("packages").insert({
            student_id: studentId, classes_total: p.classesTotal, amount: p.amount, tier_name: p.tierName || null, notes: p.note || null,
            payment_confirmed: p.paymentConfirmed || false, payment_method: p.paymentMethod || null,
          });
        }
      }

      // Sync guardian links: create new guardian people as needed, keep existing ones'
      // contact details (including email) current, and upsert the relationship rows.
      // "Other" isn't saved literally — whatever they typed becomes the relation itself.
      const keptLinkIds = links.map((l) => l.linkId).filter(Boolean);
      const removedLinkIds = originalLinkIds.filter((id) => !keptLinkIds.includes(id));
      for (const id of removedLinkIds) {
        await supabase.from("student_guardians").delete().eq("id", id);
      }

      for (const l of links) {
        const finalRelation = l.relation === "Other" ? (l.relationOther || "").trim() || "Other" : l.relation;
        let guardianId = l.guardianId;
        if (!guardianId && l.name.trim()) {
          const { data, error } = await supabase.from("guardians").insert({ name: l.name.trim(), phone: l.phone.trim(), email: l.email.trim() }).select().single();
          if (error) throw error;
          guardianId = data.id;
        } else if (guardianId && l.isExisting) {
          await supabase.from("guardians").update({ email: l.email.trim() }).eq("id", guardianId);
        }
        if (!guardianId) continue;
        if (l.linkId) {
          await supabase.from("student_guardians").update({ relation: finalRelation, emergency: l.emergency }).eq("id", l.linkId);
        } else {
          await supabase.from("student_guardians").insert({ student_id: studentId, guardian_id: guardianId, relation: finalRelation, emergency: l.emergency });
        }
      }

      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Modal title={initial ? "Edit student" : "Add a student"} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Student's name" /></Field>
        <Field label="Date of birth"><input style={inputStyle} type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></Field>
      </div>
      <Field label="Level">
        <select style={inputStyle} value={levelId} onChange={(e) => setLevelId(e.target.value)}>
          <option value="">Unassigned</option>
          {[...levels].sort((a, b) => a.order_num - b.order_num).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </Field>
      <Field label="Notes (allergies, needs, etc.)"><textarea style={{ ...inputStyle, minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      {addingNote ? (
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 10, marginTop: -6, marginBottom: 12 }}>
          <textarea
            style={{ ...inputStyle, minHeight: 50 }}
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder="What happened, what to keep an eye on, etc."
            autoFocus
          />
          <p style={{ fontSize: 11, color: T.inkSoft, margin: "4px 0 8px" }}>Will be appended below as: "{formatSydneyDate(new Date())} by {currentUserLabel}: …"</p>
          <div className="flex gap-2">
            <Btn size="sm" onClick={addNote} disabled={!newNoteText.trim()}>Add</Btn>
            <Btn size="sm" variant="ghost" onClick={() => { setAddingNote(false); setNewNoteText(""); }}>Cancel</Btn>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: -6, marginBottom: 12 }}>
          <Btn size="sm" variant="ghost" onClick={() => setAddingNote(true)}>+ Add note</Btn>
        </div>
      )}
      <Field label="Photo/video consent for social media">
        <select style={inputStyle} value={videoConsent} onChange={(e) => setVideoConsent(e.target.value)}>
          <option value="">N/A — not asked</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </Field>

      {remindersEnabled && (
        <label className="flex items-center gap-2" style={{ fontSize: 13, color: T.ink, marginBottom: 12 }}>
          <input type="checkbox" checked={reminderOptOut} onChange={(e) => setReminderOptOut(e.target.checked)} />
          Opt out of automatic renewal reminder emails (a staff member may still follow up directly)
        </label>
      )}

      <Field label="Access code (parent lookup & QR)">
        <div className="flex gap-2">
          <input style={{ ...inputStyle, letterSpacing: 2, fontWeight: 600 }} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Auto-generated if left blank" />
          <Btn size="sm" variant="ghost" onClick={regenerateCode} disabled={regenerating}>{regenerating ? "Generating…" : "Generate new"}</Btn>
        </div>
      </Field>

      {initial?.id ? <PackagesSection studentId={initial.id} /> : <PendingPackagesEditor pendingPackages={pendingPackages} setPendingPackages={setPendingPackages} onDirtyChange={setPendingPackagesDirty} />}

      <div className="mt-2 mb-1">
        <span className="text-xs font-medium block mb-2" style={{ color: T.inkSoft }}>Parent / emergency contacts</span>
        <div className="flex gap-2 mb-2 relative">
          <input style={inputStyle} placeholder="Search existing guardians by name…" value={guardianQuery} onChange={(e) => setGuardianQuery(e.target.value)} />
          <Btn size="sm" onClick={addNewGuardian}>+ New</Btn>
          {matches.length > 0 && (
            <div style={{ position: "absolute", top: 38, left: 0, right: 90, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, zIndex: 5, maxHeight: 140, overflowY: "auto" }}>
              {matches.map((g) => (
                <button key={g.id} onClick={() => linkExistingGuardian(g)} style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", fontSize: 13 }}>
                  {g.name} <span style={{ color: T.inkSoft, fontSize: 11 }}>· {g.phone}{g.email ? ` · ${g.email}` : ""}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {links.map((l, i) => (
        <div key={i} style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input style={inputStyle} placeholder="Name" value={l.name} disabled={!!l.isExisting} onChange={(e) => updateLink(i, "name", e.target.value)} />
            <input style={inputStyle} placeholder="Phone" value={l.phone} disabled={!!l.isExisting} onChange={(e) => updateLink(i, "phone", e.target.value)} />
          </div>
          <input style={{ ...inputStyle, marginBottom: 8 }} type="email" placeholder="Email" value={l.email} onChange={(e) => updateLink(i, "email", e.target.value)} />
          <div className="flex items-center gap-3 flex-wrap">
            <select style={{ ...inputStyle, width: 140 }} value={l.relation} onChange={(e) => updateLink(i, "relation", e.target.value)}>
              <option value="">Select…</option>
              {RELATION_OPTIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
            {l.relation === "Other" && (
              <input style={{ ...inputStyle, width: 140 }} placeholder="Please specify" value={l.relationOther} onChange={(e) => updateLink(i, "relationOther", e.target.value)} />
            )}
            <label className="flex items-center gap-1.5 text-xs" style={{ color: T.inkSoft }}>
              <input type="checkbox" checked={l.emergency} onChange={(e) => updateLink(i, "emergency", e.target.checked)} /> Emergency contact
            </label>
            <button onClick={() => removeLink(i)} style={{ color: T.terracotta, marginLeft: "auto" }}>✕</button>
          </div>
          {l.isExisting && <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>Existing guardian — name/phone shared across their students; edit those from any of them. Email can be updated here.</p>}
        </div>
      ))}

      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="success" onClick={handleSaveClick} disabled={saving}>{saving ? "Saving…" : initial ? "Save changes" : "Save student"}</Btn>
      </div>
    </Modal>
    {confirmDirtyPackage && (
      <ConfirmModal
        title="Unsaved package changes"
        message="You have a package entry that hasn't been saved yet — if you continue, it will be lost. Go back and click Save changes / Add package first, or continue without it?"
        confirmLabel="Continue without saving it"
        onConfirm={() => { setConfirmDirtyPackage(false); save(); }}
        onCancel={() => setConfirmDirtyPackage(false)}
      />
    )}
    </>
  );
}

function BookClassModal({ student, pkg, onClose, onBooked }) {
  const [classes, setClasses] = useState([]);
  const [enrolledIds, setEnrolledIds] = useState([]);
  const [enrolledClasses, setEnrolledClasses] = useState([]);
  const [skips, setSkips] = useState([]);
  const [selected, setSelected] = useState("");
  const [startDate, setStartDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("classes").select("*"),
      supabase.from("enrollments").select("class_id, classes(id, label, day, time, end_time)").eq("student_id", student.id),
      supabase.from("class_skips").select("class_id, date"),
    ]).then(([cRes, eRes, skRes]) => {
      setClasses((cRes.data || []).slice().sort(compareClassSchedule));
      setEnrolledIds((eRes.data || []).map((e) => e.class_id));
      setEnrolledClasses((eRes.data || []).map((e) => e.classes).filter(Boolean));
      setSkips(skRes.data || []);
      setLoading(false);
    });
  }, [student.id]);

  const available = classes.filter((c) => !enrolledIds.includes(c.id));

  const selectClass = (classId) => {
    setSelected(classId);
    const cls = classes.find((c) => c.id === classId);
    const nextOcc = cls ? nextOccurrenceOf(cls, skips, localDateStr) : null;
    setStartDate(nextOcc?.dateStr || localDateStr(new Date()));
  };

  const book = async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    const { error } = await supabase.from("enrollments").insert({ student_id: student.id, class_id: selected, start_date: startDate || null });
    setSaving(false);
    if (error) { setError(error.message); return; }

    const bookedClass = classes.find((c) => c.id === selected);
    const nextOcc = bookedClass ? nextOccurrenceOf(bookedClass, skips, localDateStr) : null;
    const { data: guardianLinks } = await supabase.from("student_guardians").select("guardians(email)").eq("student_id", student.id);
    const guardianEmails = [...new Set((guardianLinks || []).map((g) => g.guardians?.email).filter(Boolean))];

    onBooked({
      guardianEmails,
      emailStudents: [{ id: student.id, name: student.name, code: student.code, day: bookedClass?.day || null, startDate: nextOcc?.dateStr || bookedClass?.start_date || null, time: bookedClass?.time || null, endTime: bookedClass?.end_time || null }],
    });
  };

  const pkgRemaining = pkg ? pkg.classes_total - pkg.classes_used : 0;
  const pkgHasAny = !!pkg && pkg.classes_total > 0;

  return (
    <Modal title={`Book ${student.name} into a class`} onClose={onClose}>
      {!loading && enrolledClasses.length > 0 && (
        <div style={{ background: `${T.gold}18`, border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12.5, color: T.ink, lineHeight: 1.6 }}>
          <strong>Already in:</strong> {enrolledClasses.map((c) => `${c.day} ${formatTimeRange(c.time, c.end_time)}`).join(", ")}
          <br />
          <strong>Package:</strong> {pkgHasAny ? `${pkgRemaining} class${pkgRemaining === 1 ? "" : "es"} remaining` : "No package on file"}
        </div>
      )}
      {loading ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>
      ) : available.length === 0 ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>{classes.length === 0 ? "No classes set up yet — add one under the Classes tab first." : "Already booked into every class."}</p>
      ) : (
        <>
          <Field label="Class">
            <select style={inputStyle} value={selected} onChange={(e) => selectClass(e.target.value)}>
              <option value="">Select a class…</option>
              {available.map((c) => <option key={c.id} value={c.id}>{c.label} — {c.day} {formatTimeRange(c.time, c.end_time)}</option>)}
            </select>
          </Field>
          {selected && (
            <>
              <Field label="Starting from">
                <input style={inputStyle} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <p style={{ fontSize: 11, color: T.inkSoft, marginTop: -6, marginBottom: 10 }}>They'll only show up on this class's roster from this date onward — not retroactively on past dates.</p>
            </>
          )}
          {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 8 }}>{error}</p>}
          <div className="flex justify-end gap-2 mt-2">
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn variant="success" onClick={book} disabled={saving || !selected}>{saving ? "Booking…" : "Book"}</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

// Moves a student from one class to another in one action, instead of manually
// removing then re-adding. Deletes the old enrollment and creates a new one — so
// past attendance history on the old class stays intact (attendance rows aren't
// touched, only the enrollment record), but the roster reflects the change from
// whatever start date is chosen.
function TransferClassModal({ student, onClose, onTransferred }) {
  const [currentEnrollments, setCurrentEnrollments] = useState([]); // [{id, classId, label}]
  const [allClasses, setAllClasses] = useState([]);
  const [skips, setSkips] = useState([]);
  const [fromEnrollmentId, setFromEnrollmentId] = useState("");
  const [toClassId, setToClassId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("enrollments").select("id, class_id, classes(id, label, day, time, end_time)").eq("student_id", student.id),
      supabase.from("classes").select("*"),
      supabase.from("class_skips").select("class_id, date"),
    ]).then(([eRes, cRes, skRes]) => {
      const enrolled = (eRes.data || []).filter((e) => e.classes).map((e) => ({ id: e.id, classId: e.class_id, label: `${e.classes.label} — ${e.classes.day} ${formatTimeRange(e.classes.time, e.classes.end_time)}` }));
      setCurrentEnrollments(enrolled);
      if (enrolled.length === 1) setFromEnrollmentId(enrolled[0].id);
      setAllClasses((cRes.data || []).slice().sort(compareClassSchedule));
      setSkips(skRes.data || []);
      setLoading(false);
    });
  }, [student.id]);

  const fromClassId = currentEnrollments.find((e) => e.id === fromEnrollmentId)?.classId;
  const availableTo = allClasses.filter((c) => c.id !== fromClassId && !currentEnrollments.some((e) => e.classId === c.id));

  const selectTo = (classId) => {
    setToClassId(classId);
    const cls = allClasses.find((c) => c.id === classId);
    const nextOcc = cls ? nextOccurrenceOf(cls, skips, localDateStr) : null;
    setStartDate(nextOcc?.dateStr || localDateStr(new Date()));
  };

  const transfer = async () => {
    if (!fromEnrollmentId || !toClassId) return;
    setSaving(true);
    setError("");
    const { error: delErr } = await supabase.from("enrollments").delete().eq("id", fromEnrollmentId);
    if (delErr) { setError(delErr.message); setSaving(false); return; }
    const { error: insErr } = await supabase.from("enrollments").insert({ student_id: student.id, class_id: toClassId, start_date: startDate || null });
    setSaving(false);
    if (insErr) { setError(insErr.message); return; }
    onTransferred();
  };

  return (
    <Modal title={`Transfer ${student.name} to a different class`} onClose={onClose}>
      {loading ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>
      ) : currentEnrollments.length === 0 ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>{student.name} isn't currently booked into any class — use "Book class" instead.</p>
      ) : (
        <>
          {currentEnrollments.length > 1 && (
            <Field label="Transfer from">
              <select style={inputStyle} value={fromEnrollmentId} onChange={(e) => setFromEnrollmentId(e.target.value)}>
                <option value="">Select which class…</option>
                {currentEnrollments.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
            </Field>
          )}
          {fromEnrollmentId && (
            availableTo.length === 0 ? (
              <p style={{ fontSize: 13, color: T.inkSoft }}>No other classes to transfer into.</p>
            ) : (
              <>
                <Field label="Transfer to">
                  <select style={inputStyle} value={toClassId} onChange={(e) => selectTo(e.target.value)}>
                    <option value="">Select a class…</option>
                    {availableTo.map((c) => <option key={c.id} value={c.id}>{c.label} — {c.day} {formatTimeRange(c.time, c.end_time)}</option>)}
                  </select>
                </Field>
                {toClassId && (
                  <>
                    <Field label="Starting from">
                      <input style={inputStyle} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </Field>
                    <p style={{ fontSize: 11, color: T.inkSoft, marginTop: -6, marginBottom: 10 }}>Their past attendance in the old class stays on record — only the current booking moves.</p>
                  </>
                )}
              </>
            )
          )}
          {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 8 }}>{error}</p>}
          <div className="flex justify-end gap-2 mt-2">
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn variant="success" onClick={transfer} disabled={saving || !fromEnrollmentId || !toClassId}>{saving ? "Transferring…" : "Transfer"}</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}
function SendConfirmationModal({ student, onClose, onReady, onMarkedManually }) {
  const [options, setOptions] = useState([]); // {classId, day, time, endTime, startDate}
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("enrollments").select("classes(id, day, time, end_time, start_date, end_date)").eq("student_id", student.id),
      supabase.from("class_skips").select("class_id, date"),
    ]).then(([eRes, skRes]) => {
      const skips = skRes.data || [];
      const opts = (eRes.data || [])
        .map((e) => e.classes)
        .filter(Boolean)
        .map((c) => {
          const nextOcc = nextOccurrenceOf(c, skips, localDateStr);
          return { classId: c.id, day: c.day, time: c.time, endTime: c.end_time, startDate: nextOcc?.dateStr || c.start_date || null };
        });
      setOptions(opts);
      if (opts.length === 1) setSelected(opts[0].classId);
      setLoading(false);
    });
  }, [student.id]);

  const proceed = async () => {
    const opt = options.find((o) => o.classId === selected);
    if (!opt) return;
    const { data: guardianLinks } = await supabase.from("student_guardians").select("guardians(email)").eq("student_id", student.id);
    const guardianEmails = [...new Set((guardianLinks || []).map((g) => g.guardians?.email).filter(Boolean))];
    onReady({
      guardianEmails,
      emailStudents: [{ id: student.id, name: student.name, code: student.code, day: opt.day, startDate: opt.startDate, time: opt.time, endTime: opt.endTime }],
    });
  };

  // For when the studio already told the family some other way (in person, phone,
  // WhatsApp) — clears the "Send confirmation" nag without actually emailing
  // anything. Tagged 'manual' so it stays distinguishable from a real send.
  const markManually = async () => {
    setMarking(true);
    await supabase.from("students").update({
      confirmation_email_sent: true,
      confirmation_email_sent_at: new Date().toISOString(),
      confirmation_sent_method: "manual",
    }).eq("id", student.id);
    setMarking(false);
    onMarkedManually();
  };

  return (
    <Modal title={`Send confirmation to ${student.name}'s parent`} onClose={onClose}>
      {loading ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>
      ) : options.length === 0 ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>Not booked into any class yet — book them first, then a confirmation can be sent.</p>
      ) : (
        <>
          {options.length > 1 && (
            <Field label="Which class?">
              <select style={inputStyle} value={selected} onChange={(e) => setSelected(e.target.value)}>
                <option value="">Select…</option>
                {options.map((o) => <option key={o.classId} value={o.classId}>{o.day} {formatTimeRange(o.time, o.endTime)}</option>)}
              </select>
            </Field>
          )}
          <p style={{ fontSize: 12, color: T.inkSoft, marginTop: -2, marginBottom: 4 }}>
            Send an email now, or mark it as already confirmed if you told the family another way.
          </p>
          <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
            <button onClick={markManually} disabled={marking || !selected} style={{ fontSize: 12.5, color: T.inkSoft, textDecoration: "underline" }}>
              {marking ? "Marking…" : "Mark as already confirmed"}
            </button>
            <div className="flex gap-2">
              <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
              <Btn variant="success" onClick={proceed} disabled={!selected}>Send email now →</Btn>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

export default function StudentsView({ focusStudentCode }) {
  const [students, setStudents] = useState([]);
  const [levels, setLevels] = useState([]);
  const [guardians, setGuardians] = useState([]);
  const [pkgSummaryByStudent, setPkgSummaryByStudent] = useState({});
  const [classesByStudent, setClassesByStudent] = useState({});
  const [guardiansByStudent, setGuardiansByStudent] = useState({});
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [showingQr, setShowingQr] = useState(null);
  const [viewingInfo, setViewingInfo] = useState(null);
  const [booking, setBooking] = useState(null);
  const [sendingConfirmation, setSendingConfirmation] = useState(null);
  const [sendingPackageReminder, setSendingPackageReminder] = useState(null);
  const [upgradingLevel, setUpgradingLevel] = useState(null);
  const [transferring, setTransferring] = useState(null);
  const [allClassesCount, setAllClassesCount] = useState(0);
  const [confirmResend, setConfirmResend] = useState(null);
  const [emailPreview, setEmailPreview] = useState(null);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [consentFilter, setConsentFilter] = useState("all"); // 'all' | 'yes' | 'no' | 'na'
  const [bookingFilter, setBookingFilter] = useState("all"); // 'all' | 'unbooked'
  const [levelFilter, setLevelFilter] = useState("all"); // 'all' | 'unassigned' | <level id>
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, lRes, gRes, pRes, cRes, enRes, sgRes] = await Promise.all([
      supabase.from("students").select("*").order("name"),
      supabase.from("levels").select("*"),
      supabase.from("guardians").select("*").order("name"),
      supabase.from("student_package_summary").select("*"),
      supabase.from("classes").select("id", { count: "exact", head: true }),
      supabase.from("enrollments").select("student_id, classes(id, day, time, end_time)"),
      supabase.from("student_guardians").select("student_id, guardians(name)"),
    ]);
    setStudents(sRes.data || []);
    setLevels(lRes.data || []);
    setGuardians(gRes.data || []);
    const map = {};
    (pRes.data || []).forEach((p) => { map[p.student_id] = p; });
    setPkgSummaryByStudent(map);
    setAllClassesCount(cRes.count || 0);
    const classesMap = {};
    (enRes.data || []).forEach((e) => { if (e.classes) (classesMap[e.student_id] ||= []).push(e.classes); });
    setClassesByStudent(classesMap);
    const guardiansMap = {};
    (sgRes.data || []).forEach((sg) => { if (sg.guardians?.name) (guardiansMap[sg.student_id] ||= []).push(sg.guardians.name); });
    setGuardiansByStudent(guardiansMap);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // A link from an admin notification email (e.g. an absence notice) lands here
  // with a specific student in mind — search by their code so they're the only
  // (or top) result, regardless of which page/filter was last left active.
  useEffect(() => {
    if (focusStudentCode) { setQuery(focusStudentCode); setPage(1); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusStudentCode]);

  const focusRef = useRef(null);
  useEffect(() => {
    if (focusStudentCode && focusRef.current) focusRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  const levelById = Object.fromEntries(levels.map((l) => [l.id, l]));
  const filtered = students
    .filter((s) => !!s.archived === showArchived)
    .filter((s) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      if (s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)) return true;
      return (guardiansByStudent[s.id] || []).some((n) => n.toLowerCase().includes(q));
    })
    .filter((s) => {
      if (consentFilter === "all") return true;
      if (consentFilter === "yes") return s.video_consent === true;
      if (consentFilter === "no") return s.video_consent === false;
      return s.video_consent === null || s.video_consent === undefined;
    })
    .filter((s) => (bookingFilter === "unbooked" ? (classesByStudent[s.id] || []).length === 0 : true))
    .filter((s) => {
      if (levelFilter === "all") return true;
      if (levelFilter === "unassigned") return !s.level_id;
      return s.level_id === levelFilter;
    });

  const setConsentFilterAndResetPage = (val) => { setConsentFilter(val); setPage(1); };
  const setBookingFilterAndResetPage = (val) => { setBookingFilter(val); setPage(1); };
  const setLevelFilterAndResetPage = (val) => { setLevelFilter(val); setPage(1); };

  // At-a-glance counts for the stat row — computed over the current archived/active
  // view but ignoring search text and the other filters, so each number always
  // reflects "how many, total" rather than shrinking as other filters narrow things
  // down. Clicking a tile toggles that one filter on/off.
  const inView = students.filter((s) => !!s.archived === showArchived);
  const unassignedLevelCount = inView.filter((s) => !s.level_id).length;
  const unbookedCount = inView.filter((s) => (classesByStudent[s.id] || []).length === 0).length;
  const consentDeclinedCount = inView.filter((s) => s.video_consent === false).length;
  const toggleLevelFilter = (val) => setLevelFilterAndResetPage(levelFilter === val ? "all" : val);
  const toggleBookingFilter = (val) => setBookingFilterAndResetPage(bookingFilter === val ? "all" : val);
  const toggleConsentFilter = (val) => setConsentFilterAndResetPage(consentFilter === val ? "all" : val);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const paginated = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const setQueryAndResetPage = (val) => { setQuery(val); setPage(1); };
  const toggleArchivedAndResetPage = () => { setShowArchived((v) => !v); setPage(1); };

  const openPackageReminder = async (s, pkg) => {
    const { data: guardianLinks } = await supabase.from("student_guardians").select("guardians(email)").eq("student_id", s.id);
    const guardianEmails = [...new Set((guardianLinks || []).map((g) => g.guardians?.email).filter(Boolean))];
    setSendingPackageReminder({ student: s, guardianEmails, packageSize: pkg.classes_total, classesUsed: pkg.classes_used });
  };
  const handlePaymentReminderClick = (s, pkg) => {
    if (s.last_renewal_reminder_sent_at) {
      setConfirmResend({ student: s, pkg });
    } else {
      openPackageReminder(s, pkg);
    }
  };

  const doArchive = async (id, archived) => {
    await supabase.from("students").update({ archived }).eq("id", id);
    setConfirmArchive(null);
    load();
  };
  const doRemove = async (id) => {
    // Before deleting, find which guardians are linked to this student — if any of
    // them turn out to have no other students once this one's gone, their record is
    // just clutter and gets removed too.
    const { data: links } = await supabase.from("student_guardians").select("guardian_id").eq("student_id", id);
    const guardianIds = [...new Set((links || []).map((l) => l.guardian_id))];

    await supabase.from("student_guardians").delete().eq("student_id", id);
    await supabase.from("students").delete().eq("id", id);

    for (const guardianId of guardianIds) {
      const { count } = await supabase.from("student_guardians").select("id", { count: "exact", head: true }).eq("guardian_id", guardianId);
      if (!count) {
        await supabase.from("guardians").delete().eq("id", guardianId);
      }
    }

    setConfirmRemove(null);
    load();
  };

  if (loading) return <p style={{ color: T.inkSoft }}>Loading…</p>;

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <StatChip icon="🎓" count={unassignedLevelCount} label="Level unassigned" active={levelFilter === "unassigned"} onClick={() => toggleLevelFilter("unassigned")} />
        <StatChip icon="📅" count={unbookedCount} label="Not booked into a class" active={bookingFilter === "unbooked"} onClick={() => toggleBookingFilter("unbooked")} />
        <StatChip icon="📷" count={consentDeclinedCount} label="Declined social media consent" active={consentFilter === "no"} onClick={() => toggleConsentFilter("no")} />
      </div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <input style={{ ...inputStyle, width: 220, maxWidth: "60vw" }} placeholder="Search student or parent name…" value={query} onChange={(e) => setQueryAndResetPage(e.target.value)} />
          <select value={consentFilter} onChange={(e) => setConsentFilterAndResetPage(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 10px", fontSize: 13 }}>
            <option value="all">Social media consent: All</option>
            <option value="yes">Consent: Yes</option>
            <option value="no">Consent: No</option>
            <option value="na">Consent: N/A</option>
          </select>
          <select value={bookingFilter} onChange={(e) => setBookingFilterAndResetPage(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 10px", fontSize: 13 }}>
            <option value="all">Booking: All</option>
            <option value="unbooked">Not booked into a class</option>
          </select>
          <select value={levelFilter} onChange={(e) => setLevelFilterAndResetPage(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 10px", fontSize: 13 }}>
            <option value="all">Level: All</option>
            <option value="unassigned">Unassigned</option>
            {[...levels].sort((a, b) => a.order_num - b.order_num).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <button onClick={toggleArchivedAndResetPage} style={{ fontSize: 12, color: showArchived ? T.maroon : T.inkSoft, fontWeight: showArchived ? 600 : 400 }}>
            {showArchived ? "← Back to active students" : "View archived students"}
          </button>
        </div>
        {!showArchived && <Btn onClick={() => setAdding(true)}>+ Add student</Btn>}
      </div>
      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", color: T.inkSoft }}>
          <p>{showArchived ? "No archived students." : "No students yet. Add the first one to get started."}</p>
        </div>
      )}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <span style={{ fontSize: 12, color: T.inkSoft }}>{filtered.length} student{filtered.length === 1 ? "" : "s"} · Page {clampedPage} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={clampedPage === 1} style={{ fontSize: 12, color: clampedPage === 1 ? `${T.inkSoft}66` : T.maroon, fontWeight: 500 }}>← Prev</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={clampedPage === totalPages} style={{ fontSize: 12, color: clampedPage === totalPages ? `${T.inkSoft}66` : T.maroon, fontWeight: 500 }}>Next →</button>
          </div>
        </div>
      )}
      <div className="grid gap-4">
        {paginated.map((s) => {
          const pkg = pkgSummaryByStudent[s.id];
          const remaining = pkg ? pkg.classes_total - pkg.classes_used : 0;
          const studentClasses = classesByStudent[s.id] || [];
          const isFocused = focusStudentCode && s.code.toUpperCase() === focusStudentCode.toUpperCase();
          return (
            <div
              key={s.id}
              ref={isFocused ? focusRef : null}
              style={{
                background: "#fff", borderRadius: 10, padding: 18, opacity: s.archived ? 0.7 : 1,
                border: isFocused ? `2px solid ${T.gold}` : `1px solid ${T.line}`,
                borderLeft: `5px solid ${s.archived ? T.inkSoft : T.gold}`,
                boxShadow: isFocused ? `0 0 0 3px ${T.gold}33` : "none",
              }}
              className="flex flex-col gap-3"
            >
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <button onClick={() => setViewingInfo(s)} style={{ fontFamily: "Fraunces, serif", fontSize: 19, color: T.maroonDark, textDecoration: "underline", textDecorationColor: `${T.maroonDark}33`, textUnderlineOffset: 3 }}>{s.name}</button>
                  {s.dob && computeAge(s.dob) != null && <span style={{ fontSize: 13, color: T.inkSoft }}>· {computeAge(s.dob)}y</span>}
                  <span style={{ fontSize: 12, color: T.gold, fontWeight: 700, letterSpacing: 1 }}>· {s.code}</span>
                  {!s.archived && (
                    <button onClick={() => setShowingQr(s)} style={{ ...actionBtnStyle, color: T.gold, borderColor: `${T.gold}55`, fontSize: 12, padding: "3px 9px" }}>QR code</button>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <LevelBadge level={levelById[s.level_id]} />
                  <PackageBadge remaining={remaining} hasAny={!!pkg && pkg.classes_total > 0} />
                  <ConsentBadge consent={s.video_consent} />
                  <ClassBadge classes={studentClasses} />
                  {/* Keeps the "was this confirmed" fact visible even once a resend
                      button appears below — resending updates the timestamp but
                      never hides that a confirmation went out at some point. */}
                  {s.confirmation_email_sent && (
                    <span style={{ fontSize: 11, color: T.inkSoft }}>✓ Confirmed {formatSydneyDate(s.confirmation_email_sent_at)}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>
                  👪 {(guardiansByStudent[s.id] || []).length > 0 ? guardiansByStudent[s.id].join(", ") : "No parent/guardian on file"}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {!s.archived && studentClasses.length === 0 && <button onClick={() => setBooking(s)} style={{ ...actionBtnStyle, color: T.sage, borderColor: `${T.sage}55` }}>Book class</button>}
                {!s.archived && allClassesCount > 1 && (
                  <button onClick={() => setTransferring(s)} style={{ ...actionBtnStyle, color: T.gold, borderColor: `${T.gold}55` }}>⇄ Transfer</button>
                )}
                {!s.archived && !s.confirmation_email_sent && (
                  <button onClick={() => setSendingConfirmation(s)} style={{ ...actionBtnStyle, color: T.gold, borderColor: `${T.gold}55` }}>⚠ Send confirmation</button>
                )}
                {/* A resend is only offered before they've actually started using the
                    package (classes_used === 0) — e.g. the guardian's email was
                    wrong or got updated. Once classes have been attended/missed,
                    the original confirmation has clearly already reached someone
                    who's been bringing the student, so a resend isn't needed. */}
                {!s.archived && s.confirmation_email_sent && (!pkg || pkg.classes_used === 0) && (
                  <button onClick={() => setSendingConfirmation(s)} style={{ ...actionBtnStyle, color: T.gold, borderColor: `${T.gold}55` }}>↻ Resend confirmation</button>
                )}
                {!s.archived && pkg && pkg.classes_total > 0 && remaining <= 0 && (
                  <button onClick={() => handlePaymentReminderClick(s, pkg)} style={{ ...actionBtnStyle, color: T.terracotta, borderColor: `${T.terracotta}55` }}>💳 Payment required</button>
                )}
                {!s.archived && levels.length > 0 && (
                  <button onClick={() => setUpgradingLevel(s)} style={{ ...actionBtnStyle, color: T.sage, borderColor: `${T.sage}55` }}>⬆ Upgrade Level</button>
                )}
                {!s.archived && <button onClick={() => setEditing(s)} style={{ ...actionBtnStyle, color: T.maroon, borderColor: `${T.maroon}55` }}>Edit</button>}
                {s.archived ? (
                  <button onClick={() => doArchive(s.id, false)} style={{ ...actionBtnStyle, color: T.sage, borderColor: `${T.sage}55` }}>Restore</button>
                ) : (
                  <button onClick={() => setConfirmArchive(s)} style={{ ...actionBtnStyle, color: T.inkSoft, borderColor: T.line }}>Archive</button>
                )}
                <button onClick={() => setConfirmRemove(s)} style={{ ...actionBtnStyle, color: T.terracotta, borderColor: `${T.terracotta}55` }}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>
      {filtered.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-2 mt-4">
          <span style={{ fontSize: 12, color: T.inkSoft }}>{filtered.length} student{filtered.length === 1 ? "" : "s"} · Page {clampedPage} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={clampedPage === 1} style={{ fontSize: 12, color: clampedPage === 1 ? `${T.inkSoft}66` : T.maroon, fontWeight: 500 }}>← Prev</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={clampedPage === totalPages} style={{ fontSize: 12, color: clampedPage === totalPages ? `${T.inkSoft}66` : T.maroon, fontWeight: 500 }}>Next →</button>
          </div>
        </div>
      )}
      {(adding || editing) && (
        <StudentModal
          initial={editing}
          levels={levels}
          allGuardians={guardians}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); load(); }}
        />
      )}
      {showingQr && <QrModal student={showingQr} onClose={() => setShowingQr(null)} />}
      {viewingInfo && <StudentInfoModal student={viewingInfo} level={levelById[viewingInfo.level_id]} onClose={() => setViewingInfo(null)} />}
      {booking && (
        <BookClassModal
          student={booking}
          pkg={pkgSummaryByStudent[booking.id]}
          onClose={() => setBooking(null)}
          onBooked={({ guardianEmails, emailStudents }) => {
            setBooking(null);
            load();
            setEmailPreview({ guardianEmails, students: emailStudents });
          }}
        />
      )}
      {sendingConfirmation && (
        <SendConfirmationModal
          student={sendingConfirmation}
          onClose={() => setSendingConfirmation(null)}
          onReady={({ guardianEmails, emailStudents }) => {
            setSendingConfirmation(null);
            setEmailPreview({ guardianEmails, students: emailStudents });
          }}
          onMarkedManually={() => { setSendingConfirmation(null); load(); }}
        />
      )}
      {sendingPackageReminder && (
        <PackageReminderModal
          student={sendingPackageReminder.student}
          guardianEmails={sendingPackageReminder.guardianEmails}
          packageSize={sendingPackageReminder.packageSize}
          classesUsed={sendingPackageReminder.classesUsed}
          onCancel={() => setSendingPackageReminder(null)}
          onSent={() => setSendingPackageReminder(null)}
        />
      )}
      {upgradingLevel && (
        <UpgradeLevelModal
          student={upgradingLevel}
          levels={levels}
          onClose={() => setUpgradingLevel(null)}
          onUpgraded={() => { setUpgradingLevel(null); load(); }}
        />
      )}
      {transferring && (
        <TransferClassModal
          student={transferring}
          onClose={() => setTransferring(null)}
          onTransferred={() => { setTransferring(null); load(); }}
        />
      )}
      {confirmResend && (
        <ConfirmModal
          title="Send another reminder?"
          message={`A reminder was already sent to ${confirmResend.student.name}'s family ${daysAgo(confirmResend.student.last_renewal_reminder_sent_at)}. Send another one?`}
          confirmLabel="Send again"
          onConfirm={() => { openPackageReminder(confirmResend.student, confirmResend.pkg); setConfirmResend(null); }}
          onCancel={() => setConfirmResend(null)}
        />
      )}
      {emailPreview && (
        <EmailPreviewModal
          guardianEmails={emailPreview.guardianEmails}
          students={emailPreview.students}
          onCancel={() => setEmailPreview(null)}
          onSent={() => { setEmailPreview(null); load(); }}
        />
      )}
      {confirmArchive && (
        <TypeToConfirmModal
          title="Archive this student?"
          message={`${confirmArchive.name} will be hidden from the active roster, but their attendance, packages and level history are all kept. You can restore them anytime.`}
          confirmString={confirmArchive.code}
          confirmLabel="Archive"
          onConfirm={() => doArchive(confirmArchive.id, true)}
          onCancel={() => setConfirmArchive(null)}
        />
      )}
      {confirmRemove && (
        <TypeToConfirmModal
          title="Delete permanently?"
          message={`This permanently deletes ${confirmRemove.name} and all their records — bookings, attendance, packages, level history. This can't be undone. If you just want them off the active list, use Archive instead.`}
          confirmString={confirmRemove.code}
          confirmLabel="Delete permanently"
          onConfirm={() => doRemove(confirmRemove.id)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}
