import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { Btn, ConfirmModal } from "./ui";
import PackageReminderModal from "./PackageReminderModal";
import { localDateStr } from "../lib/dates";

const DUE_THRESHOLD = 2; // classes remaining at or below this counts as "coming due"

function daysAgo(isoDate) {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function DueForRenewalSection({ onChanged }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingTo, setSendingTo] = useState(null);
  const [confirmResend, setConfirmResend] = useState(null);
  const [threshold, setThreshold] = useState(2);

  const load = useCallback(async (limit) => {
    setLoading(true);
    const [sRes, pRes, settingsRes, emptiedRes] = await Promise.all([
      supabase.from("students").select("id, name, code, last_renewal_reminder_sent_at").eq("archived", false),
      supabase.from("student_package_summary").select("student_id, classes_total, classes_used"),
      supabase.from("settings").select("renewal_grace_period_days").eq("id", 1).maybeSingle(),
      supabase.rpc("get_package_emptied_dates"),
    ]);
    const pkgByStudent = Object.fromEntries((pRes.data || []).map((p) => [p.student_id, p]));
    const emptiedByStudent = Object.fromEntries((emptiedRes.data || []).map((e) => [e.student_id, e.emptied_date]));
    const graceDays = settingsRes.data?.renewal_grace_period_days ?? 7;
    const today = localDateStr(new Date());

    const due = (sRes.data || [])
      .map((s) => {
        const pkg = pkgByStudent[s.id];
        const hasPackage = !!pkg && pkg.classes_total > 0;
        if (hasPackage) {
          const remaining = pkg.classes_total - pkg.classes_used;
          if (remaining > limit) return null;
          let daysUntilSpotFrees = null;
          if (remaining <= 0 && emptiedByStudent[s.id]) {
            const daysSinceEmptied = Math.floor((new Date(today) - new Date(emptiedByStudent[s.id])) / 86400000);
            daysUntilSpotFrees = graceDays - daysSinceEmptied;
          }
          return { student: s, packageSize: pkg.classes_total, classesUsed: pkg.classes_used, remaining, hasPackage: true, daysUntilSpotFrees };
        }
        // No package on file at all (e.g. just reactivated from archive) — still
        // worth a nudge, just phrased differently since there's nothing to "run out".
        return { student: s, packageSize: 0, classesUsed: 0, remaining: 0, hasPackage: false, daysUntilSpotFrees: null };
      })
      .filter(Boolean)
      .sort((a, b) => a.remaining - b.remaining);
    setRows(due);
    setLoading(false);
  }, []);

  useEffect(() => { load(threshold); }, [load, threshold]);

  const openReminder = async (row) => {
    const { data: guardianLinks } = await supabase.from("student_guardians").select("guardians(email)").eq("student_id", row.student.id);
    const guardianEmail = (guardianLinks || []).map((g) => g.guardians?.email).find((e) => e) || null;
    setSendingTo({ student: row.student, guardianEmail, packageSize: row.packageSize, classesUsed: row.classesUsed });
  };

  const handleSendClick = (row) => {
    if (row.student.last_renewal_reminder_sent_at) {
      setConfirmResend(row);
    } else {
      openReminder(row);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap" style={{ fontSize: 13, color: T.ink }}>
        <span>Show students with</span>
        <input
          type="number" min={0} value={threshold}
          onChange={(e) => setThreshold(Math.max(0, Number(e.target.value) || 0))}
          style={{ width: 56, padding: "4px 8px", borderRadius: 6, border: `1px solid ${T.line}`, textAlign: "center", fontSize: 13 }}
        />
        <span>or fewer classes remaining</span>
      </div>
      {loading ? (
        <p style={{ color: T.inkSoft }}>Loading…</p>
      ) : (
        <>
          {rows.length === 0 && <p style={{ color: T.inkSoft }}>Nobody's coming due right now.</p>}
          <div className="grid gap-3">
            {rows.map((row) => (
              <div key={row.student.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${T.terracotta}`, borderRadius: 8, padding: 14 }} className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark }}>{row.student.name}</div>
                  <div style={{ fontSize: 12, color: row.hasPackage && row.remaining > 0 ? T.gold : T.terracotta, fontWeight: 600 }}>
                    {!row.hasPackage ? "No package on file" : row.remaining <= 0 ? "Package fully used" : `${row.remaining} class${row.remaining === 1 ? "" : "es"} remaining`}
                  </div>
                  {row.student.last_renewal_reminder_sent_at && (
                    <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>Reminder last sent {daysAgo(row.student.last_renewal_reminder_sent_at)}</div>
                  )}
                  {row.daysUntilSpotFrees != null && (
                    <div style={{ marginTop: 8, background: `${T.terracotta}18`, border: `2px solid ${T.terracotta}`, borderRadius: 8, padding: "8px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 18 }}>⚠️</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.terracotta }}>
                        {row.daysUntilSpotFrees > 0
                          ? `Spot free in ${row.daysUntilSpotFrees} day${row.daysUntilSpotFrees === 1 ? "" : "s"} if not renewed`
                          : "Grace period over — spot is now available to new enrolments"}
                      </span>
                    </div>
                  )}
                </div>
                <Btn size="sm" onClick={() => handleSendClick(row)}>Send reminder</Btn>
              </div>
            ))}
          </div>
        </>
      )}
      {confirmResend && (
        <ConfirmModal
          title="Send another reminder?"
          message={`A reminder was already sent to ${confirmResend.student.name}'s family ${daysAgo(confirmResend.student.last_renewal_reminder_sent_at)}. Send another one?`}
          confirmLabel="Send again"
          onConfirm={() => { openReminder(confirmResend); setConfirmResend(null); }}
          onCancel={() => setConfirmResend(null)}
        />
      )}
      {sendingTo && (
        <PackageReminderModal
          student={sendingTo.student}
          guardianEmail={sendingTo.guardianEmail}
          packageSize={sendingTo.packageSize}
          classesUsed={sendingTo.classesUsed}
          onCancel={() => setSendingTo(null)}
          onSent={() => { setSendingTo(null); load(threshold); onChanged && onChanged(); }}
        />
      )}
    </div>
  );
}

function SubmittedRequestsSection({ focusRenewalId, onChanged }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHandled, setShowHandled] = useState(false);
  const [approving, setApproving] = useState(null);
  const [confirmReject, setConfirmReject] = useState(null);
  const [paymentSettings, setPaymentSettings] = useState({}); // { [requestId]: { confirmed, method } }
  const focusRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("package_renewal_requests").select("*, students(name, code)").order("created_at", { ascending: false });
    setRequests(data || []);
    setPaymentSettings((prev) => {
      const next = { ...prev };
      (data || []).forEach((r) => { if (!(r.id in next)) next[r.id] = { confirmed: r.payment_claimed || false, method: "" }; });
      return next;
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!focusRenewalId || requests.length === 0) return;
    const target = requests.find((r) => r.id === focusRenewalId);
    if (target && target.status !== "pending" && !showHandled) setShowHandled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRenewalId, requests]);

  useEffect(() => {
    if (focusRef.current) focusRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  const viewScreenshot = async (path) => {
    const { data, error } = await supabase.storage.from("payment-screenshots").createSignedUrl(path, 300);
    if (error || !data) { alert("Couldn't load the screenshot."); return; }
    window.open(data.signedUrl, "_blank");
  };

  const setPaymentField = (id, field, val) => setPaymentSettings((s) => ({ ...s, [id]: { ...s[id], [field]: val } }));

  const approve = async (r) => {
    const ps = paymentSettings[r.id] || { confirmed: false, method: "" };
    setApproving(r.id);
    await supabase.from("packages").insert({
      student_id: r.student_id, classes_total: r.classes_count_snapshot, amount: r.price_snapshot, notes: r.tier_name_snapshot,
      payment_confirmed: ps.confirmed, payment_method: ps.method || null,
    });
    await supabase.from("package_renewal_requests").update({ status: "approved", reviewed_at: new Date().toISOString() }).eq("id", r.id);
    setApproving(null);
    load();
    onChanged && onChanged();
  };
  const reject = async (id) => {
    await supabase.from("package_renewal_requests").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", id);
    setConfirmReject(null);
    load();
    onChanged && onChanged();
  };

  const filtered = requests.filter((r) => (showHandled ? r.status !== "pending" : r.status === "pending"));
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  if (loading) return <p style={{ color: T.inkSoft }}>Loading…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p style={{ fontSize: 13, color: T.inkSoft }}>{pendingCount} submission{pendingCount === 1 ? "" : "s"} waiting on your confirmation.</p>
        <button onClick={() => setShowHandled((v) => !v)} style={{ fontSize: 12, color: showHandled ? T.maroon : T.inkSoft, fontWeight: showHandled ? 600 : 400, whiteSpace: "nowrap" }}>
          {showHandled ? "← Back to pending" : "View approved/rejected"}
        </button>
      </div>

      {filtered.length === 0 && <p style={{ color: T.inkSoft }}>{showHandled ? "No handled submissions yet." : "No submissions waiting."}</p>}

      <div className="grid gap-3">
        {filtered.map((r) => {
          const isFocused = r.id === focusRenewalId;
          return (
            <div
              key={r.id}
              ref={isFocused ? focusRef : null}
              style={{
                background: "#fff", borderRadius: 8, padding: 14,
                border: isFocused ? `2px solid ${T.gold}` : `1px solid ${T.line}`,
                borderLeft: `4px solid ${r.status === "pending" ? T.gold : r.status === "approved" ? T.sage : T.terracotta}`,
                boxShadow: isFocused ? `0 0 0 3px ${T.gold}33` : "none",
              }}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark }}>{r.students?.name || "Unknown student"}</div>
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                    {r.tier_name_snapshot} · {r.classes_count_snapshot} classes · ${Number(r.price_snapshot).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
                    Payment: <span style={{ color: r.payment_claimed ? T.sage : T.inkSoft, fontWeight: 600 }}>{r.payment_claimed ? "Claimed paid" : "Not marked paid"}</span>
                    {r.payment_screenshot_path && (
                      <>
                        {" · "}
                        <button onClick={() => viewScreenshot(r.payment_screenshot_path)} style={{ color: T.gold, textDecoration: "underline" }}>View screenshot</button>
                      </>
                    )}
                  </div>
                </div>
                {r.status === "pending" ? (
                  <div className="flex gap-2">
                    <Btn size="sm" variant="ghost" onClick={() => setConfirmReject(r)}>Reject</Btn>
                    <Btn variant="success" size="sm" onClick={() => approve(r)} disabled={approving === r.id}>{approving === r.id ? "Approving…" : "Approve"}</Btn>
                  </div>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 600, color: r.status === "approved" ? T.sage : T.terracotta, textTransform: "capitalize" }}>{r.status}</span>
                )}
              </div>
              {r.status === "pending" && (
                <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.line}` }}>
                  <label className="flex items-center gap-1.5" style={{ fontSize: 12, color: T.ink }}>
                    <input
                      type="checkbox"
                      checked={paymentSettings[r.id]?.confirmed || false}
                      onChange={(e) => setPaymentField(r.id, "confirmed", e.target.checked)}
                    />
                    Payment confirmed
                  </label>
                  {paymentSettings[r.id]?.confirmed && (
                    <select
                      value={paymentSettings[r.id]?.method || ""}
                      onChange={(e) => setPaymentField(r.id, "method", e.target.value)}
                      style={{ fontSize: 12, padding: "3px 6px", borderRadius: 6, border: `1px solid ${T.line}` }}
                    >
                      <option value="">Method not specified</option>
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="other">Other</option>
                    </select>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {confirmReject && (
        <ConfirmModal
          title="Reject this renewal?"
          message="No package will be added for this student."
          confirmLabel="Reject"
          onConfirm={() => reject(confirmReject.id)}
          onCancel={() => setConfirmReject(null)}
        />
      )}
    </div>
  );
}

export default function RenewalsView({ focusRenewalId }) {
  const [section, setSection] = useState(focusRenewalId ? "submitted" : "due");
  const [dueCount, setDueCount] = useState(0);
  const [submittedCount, setSubmittedCount] = useState(0);

  const loadCounts = useCallback(async () => {
    const [studentsRes, pkgRes, renRes] = await Promise.all([
      supabase.from("students").select("id").eq("archived", false),
      supabase.from("student_package_summary").select("student_id, classes_total, classes_used"),
      supabase.from("package_renewal_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    const pkgByStudent = Object.fromEntries((pkgRes.data || []).map((p) => [p.student_id, p]));
    const due = (studentsRes.data || []).filter((s) => {
      const pkg = pkgByStudent[s.id];
      const hasPackage = pkg && pkg.classes_total > 0;
      if (!hasPackage) return true;
      return (pkg.classes_total - pkg.classes_used) <= DUE_THRESHOLD;
    }).length;
    setDueCount(due);
    setSubmittedCount(renRes.count || 0);
  }, []);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  return (
    <div>
      <div className="flex gap-1 mb-4" style={{ background: T.paper, borderRadius: 8, padding: 3, display: "inline-flex" }}>
        <button
          onClick={() => setSection("due")}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, background: section === "due" ? "#fff" : "transparent", color: section === "due" ? T.maroonDark : T.inkSoft, fontWeight: section === "due" ? 600 : 400 }}
        >
          Due for renewal ({dueCount})
        </button>
        <button
          onClick={() => setSection("submitted")}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, background: section === "submitted" ? "#fff" : "transparent", color: section === "submitted" ? T.maroonDark : T.inkSoft, fontWeight: section === "submitted" ? 600 : 400 }}
        >
          Submitted requests ({submittedCount})
        </button>
      </div>

      {section === "due" ? <DueForRenewalSection onChanged={loadCounts} /> : <SubmittedRequestsSection focusRenewalId={focusRenewalId} onChanged={loadCounts} />}
    </div>
  );
}
