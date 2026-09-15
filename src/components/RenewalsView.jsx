import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { Btn, ConfirmModal } from "./ui";

export default function RenewalsView({ focusRenewalId }) {
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
  };
  const reject = async (id) => {
    await supabase.from("package_renewal_requests").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", id);
    setConfirmReject(null);
    load();
  };

  const filtered = requests.filter((r) => (showHandled ? r.status !== "pending" : r.status === "pending"));
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  if (loading) return <p style={{ color: T.inkSoft }}>Loading…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p style={{ fontSize: 13, color: T.inkSoft }}>{pendingCount} pending renewal{pendingCount === 1 ? "" : "s"}.</p>
        <button onClick={() => setShowHandled((v) => !v)} style={{ fontSize: 12, color: showHandled ? T.maroon : T.inkSoft, fontWeight: showHandled ? 600 : 400, whiteSpace: "nowrap" }}>
          {showHandled ? "← Back to pending" : "View approved/rejected"}
        </button>
      </div>

      {filtered.length === 0 && <p style={{ color: T.inkSoft }}>{showHandled ? "No handled renewals yet." : "No pending renewals."}</p>}

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
