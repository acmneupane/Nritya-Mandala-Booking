import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Field, Modal, ConfirmModal } from "./ui";

function genCode(existing) {
  const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (existing.includes(code));
  return code;
}

function ApproveModal({ request, levels, onClose, onApproved }) {
  const [name, setName] = useState(request.student_name);
  const [age, setAge] = useState(request.student_age || "");
  const [levelId, setLevelId] = useState(request.preferred_level_id || "");
  const [guardianName, setGuardianName] = useState(request.guardian_name);
  const [guardianPhone, setGuardianPhone] = useState(request.guardian_phone || "");
  const [guardianEmail, setGuardianEmail] = useState(request.guardian_email || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const approve = async () => {
    setSaving(true);
    setError("");
    try {
      const { data: existingCodes } = await supabase.from("students").select("code");
      const code = genCode((existingCodes || []).map((r) => r.code));
      const { data: student, error: sErr } = await supabase.from("students").insert({
        name: name.trim(), age: age ? Number(age) : null, level_id: levelId || null, notes: request.notes || "", code,
      }).select().single();
      if (sErr) throw sErr;

      const { data: guardian, error: gErr } = await supabase.from("guardians").insert({
        name: guardianName.trim(), phone: guardianPhone.trim(), email: guardianEmail.trim(),
      }).select().single();
      if (gErr) throw gErr;

      const { error: linkErr } = await supabase.from("student_guardians").insert({
        student_id: student.id, guardian_id: guardian.id, relation: "Parent", emergency: true,
      });
      if (linkErr) throw linkErr;

      const { error: updErr } = await supabase.from("enrollment_requests").update({
        status: "approved", created_student_id: student.id, reviewed_at: new Date().toISOString(),
      }).eq("id", request.id);
      if (updErr) throw updErr;

      onApproved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Approve enrolment" onClose={onClose} wide>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 12 }}>Review and adjust before creating the student record.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Student name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Age"><input style={inputStyle} type="number" value={age} onChange={(e) => setAge(e.target.value)} /></Field>
      </div>
      <Field label="Level">
        <select style={inputStyle} value={levelId} onChange={(e) => setLevelId(e.target.value)}>
          <option value="">Unassigned</option>
          {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </Field>
      <Field label="Guardian name"><input style={inputStyle} value={guardianName} onChange={(e) => setGuardianName(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone"><input style={inputStyle} value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} /></Field>
        <Field label="Email"><input style={inputStyle} type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} /></Field>
      </div>
      {request.notes && <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10 }}><strong>Note from parent:</strong> {request.notes}</p>}
      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <div className="flex justify-end gap-2 mt-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={approve} disabled={saving}>{saving ? "Creating…" : "Approve & create student"}</Btn>
      </div>
    </Modal>
  );
}

export default function RequestsView() {
  const [requests, setRequests] = useState([]);
  const [levels, setLevels] = useState([]);
  const [levelById, setLevelById] = useState({});
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(null);
  const [confirmReject, setConfirmReject] = useState(null);
  const [showHandled, setShowHandled] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [rRes, lRes] = await Promise.all([
      supabase.from("enrollment_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("levels").select("*").order("order_num"),
    ]);
    setRequests(rRes.data || []);
    setLevels(lRes.data || []);
    setLevelById(Object.fromEntries((lRes.data || []).map((l) => [l.id, l])));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const reject = async (id) => {
    await supabase.from("enrollment_requests").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", id);
    setConfirmReject(null);
    load();
  };

  const filtered = requests.filter((r) => (showHandled ? r.status !== "pending" : r.status === "pending"));
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  if (loading) return <p style={{ color: T.inkSoft }}>Loading…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p style={{ fontSize: 13, color: T.inkSoft }}>
          {pendingCount} pending request{pendingCount === 1 ? "" : "s"}. Share your public form link with new parents: <code style={{ background: T.paper, padding: "2px 6px", borderRadius: 4 }}>{window.location.origin}/enroll</code>
        </p>
        <button onClick={() => setShowHandled((v) => !v)} style={{ fontSize: 12, color: showHandled ? T.maroon : T.inkSoft, fontWeight: showHandled ? 600 : 400, whiteSpace: "nowrap" }}>
          {showHandled ? "← Back to pending" : "View approved/rejected"}
        </button>
      </div>

      {filtered.length === 0 && <p style={{ color: T.inkSoft }}>{showHandled ? "No handled requests yet." : "No pending requests."}</p>}

      <div className="grid gap-3">
        {filtered.map((r) => (
          <div key={r.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${r.status === "pending" ? T.gold : r.status === "approved" ? T.sage : T.terracotta}`, borderRadius: 8, padding: 14 }}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark }}>
                  {r.student_name} {r.student_age && <span style={{ fontSize: 12, color: T.inkSoft, fontFamily: "Inter, sans-serif" }}>· {r.student_age}y</span>}
                </div>
                <div style={{ fontSize: 12, color: T.inkSoft }}>
                  {r.guardian_name} · {r.guardian_phone}{r.guardian_email ? ` · ${r.guardian_email}` : ""}
                </div>
                {r.preferred_level_id && levelById[r.preferred_level_id] && (
                  <div style={{ fontSize: 11, color: T.sage, marginTop: 2 }}>Preferred: {levelById[r.preferred_level_id].name}</div>
                )}
                {r.notes && <div style={{ fontSize: 12, color: T.ink, marginTop: 4 }}>{r.notes}</div>}
              </div>
              {r.status === "pending" ? (
                <div className="flex gap-2">
                  <Btn size="sm" variant="ghost" onClick={() => setConfirmReject(r)}>Reject</Btn>
                  <Btn size="sm" onClick={() => setApproving(r)}>Approve</Btn>
                </div>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 600, color: r.status === "approved" ? T.sage : T.terracotta, textTransform: "capitalize" }}>{r.status}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {approving && <ApproveModal request={approving} levels={levels} onClose={() => setApproving(null)} onApproved={() => { setApproving(null); load(); }} />}
      {confirmReject && (
        <ConfirmModal
          title="Reject this request?"
          message={`${confirmReject.student_name}'s request will be marked rejected. No student record is created.`}
          confirmLabel="Reject"
          onConfirm={() => reject(confirmReject.id)}
          onCancel={() => setConfirmReject(null)}
        />
      )}
    </div>
  );
}
