import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { Btn, ConfirmModal } from "./ui";
import PackageReminderModal from "./PackageReminderModal";

const DUE_THRESHOLD = 2; // classes remaining at or below this counts as "coming due"

function DueForRenewalSection({ onChanged }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingTo, setSendingTo] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, pRes] = await Promise.all([
      supabase.from("students").select("id, name, code").eq("archived", false),
      supabase.from("student_package_summary").select("student_id, classes_total, classes_used"),
    ]);
    const pkgByStudent = Object.fromEntries((pRes.data || []).map((p) => [p.student_id, p]));
    const due = (sRes.data || [])
      .map((s) => {
        const pkg = pkgByStudent[s.id];
        const hasPackage = !!pkg && pkg.classes_total > 0;
        if (hasPackage) {
          const remaining = pkg.classes_total - pkg.classes_used;
          if (remaining > DUE_THRESHOLD) return null;
          return { student: s, packageSize: pkg.classes_total, classesUsed: pkg.classes_used, remaining, hasPackage: true };
        }
        // No package on file at all (e.g. just reactivated from archive) — still
        // worth a nudge, just phrased differently since there's nothing to "run out".
        return { student: s, packageSize: 0, classesUsed: 0, remaining: 0, hasPackage: false };
      })
      .filter(Boolean)
      .sort((a, b) => a.remaining - b.remaining);
    setRows(due);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openReminder = async (row) => {
    const { data: guardianLinks } = await supabase.from("student_guardians").select("guardians(email)").eq("student_id", row.student.id);
    const guardianEmail = (guardianLinks || []).map((g) => g.guardians?.email).find((e) => e) || null;
    setSendingTo({ student: row.student, guardianEmail, packageSize: row.packageSize, classesUsed: row.classesUsed });
  };

  if (loading) return <p style={{ color: T.inkSoft }}>Loading…</p>;

  return (
    <div>
      <p style={{ fontSize: 13, color: T.inkSoft, marginBottom: 14 }}>
        Students with {DUE_THRESHOLD} or fewer classes remaining on their package — worth a nudge before they run out.
      </p>
      {rows.length === 0 && <p style={{ color: T.inkSoft }}>Nobody's coming due right now.</p>}
      <div className="grid gap-3">
        {rows.map((row) => (
          <div key={row.student.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${T.terracotta}`, borderRadius: 8, padding: 14 }} className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark }}>{row.student.name}</div>
              <div style={{ fontSize: 12, color: row.hasPackage && row.remaining > 0 ? T.gold : T.terracotta, fontWeight: 600 }}>
                {!row.hasPackage ? "No package on file" : row.remaining <= 0 ? "Package fully used" : `${row.remaining} class${row.remaining === 1 ? "" : "es"} remaining`}
              </div>
            </div>
            <Btn size="sm" onClick={() => openReminder(row)}>Send reminder</Btn>
          </div>
        ))}
      </div>
      {sendingTo && (
        <PackageReminderModal
          student={sendingTo.student}
          guardianEmail={sendingTo.guardianEmail}
          packageSize={sendingTo.packageSize}
          classesUsed={sendingTo.classesUsed}
          onCancel={() => setSendingTo(null)}
          onSent={() => { setSendingTo(null); load(); onChanged && onChanged(); }}
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
  const focusRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("package_renewal_requests").select("*, students(name, code)").order("created_at", { ascending: false });
    setRequests(data || []);
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

  const approve = async (r) => {
    setApproving(r.id);
    await supabase.from("packages").insert({
      student_id: r.student_id, classes_total: r.classes_count_snapshot, amount: r.price_snapshot, notes: r.tier_name_snapshot,
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
                    <Btn size="sm" onClick={() => approve(r)} disabled={approving === r.id}>{approving === r.id ? "Approving…" : "Approve"}</Btn>
                  </div>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 600, color: r.status === "approved" ? T.sage : T.terracotta, textTransform: "capitalize" }}>{r.status}</span>
                )}
              </div>
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
