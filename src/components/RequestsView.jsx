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
  const [students, setStudents] = useState(
    (request.enrollment_request_students || [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({ id: s.id, name: s.student_name, dob: s.student_dob || "", levelId: s.preferred_level_id || "", isSibling: s.is_sibling }))
  );
  const [guardianName, setGuardianName] = useState(request.guardian_name);
  const [guardianPhone, setGuardianPhone] = useState(request.guardian_phone || "");
  const [guardianEmail, setGuardianEmail] = useState(request.guardian_email || "");
  const [emergencySame, setEmergencySame] = useState(request.emergency_same);
  const [emergencyName, setEmergencyName] = useState(request.emergency_name || "");
  const [emergencyPhone, setEmergencyPhone] = useState(request.emergency_phone || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateStudent = (i, field, val) => setStudents((ss) => ss.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)));

  const approve = async () => {
    setSaving(true);
    setError("");
    try {
      const { data: existingCodes } = await supabase.from("students").select("code");
      const usedCodes = (existingCodes || []).map((r) => r.code);

      const { data: primaryGuardian, error: gErr } = await supabase.from("guardians").insert({
        name: guardianName.trim(), phone: guardianPhone.trim(), email: guardianEmail.trim(),
      }).select().single();
      if (gErr) throw gErr;

      let emergencyGuardian = null;
      if (!emergencySame) {
        const { data, error: egErr } = await supabase.from("guardians").insert({
          name: emergencyName.trim(), phone: emergencyPhone.trim(), email: "",
        }).select().single();
        if (egErr) throw egErr;
        emergencyGuardian = data;
      }

      for (const s of students) {
        const code = genCode(usedCodes);
        usedCodes.push(code);
        const { data: created, error: sErr } = await supabase.from("students").insert({
          name: s.name.trim(), dob: s.dob || null, level_id: s.levelId || null, code, video_consent: request.video_consent,
        }).select().single();
        if (sErr) throw sErr;

        await supabase.from("student_guardians").insert({
          student_id: created.id, guardian_id: primaryGuardian.id, relation: "Parent", emergency: emergencySame,
        });
        if (emergencyGuardian) {
          await supabase.from("student_guardians").insert({
            student_id: created.id, guardian_id: emergencyGuardian.id, relation: "Emergency contact", emergency: true,
          });
        }
        await supabase.from("enrollment_request_students").update({ created_student_id: created.id }).eq("id", s.id);
      }

      const { error: updErr } = await supabase.from("enrollment_requests").update({
        status: "approved", reviewed_at: new Date().toISOString(),
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
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 12 }}>Review and adjust before creating {students.length > 1 ? "these student records" : "this student record"}.</p>

      {students.map((s, i) => (
        <div key={s.id} style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.inkSoft, marginBottom: 6 }}>{s.isSibling ? "Sibling" : "Primary student"}</div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Name"><input style={inputStyle} value={s.name} onChange={(e) => updateStudent(i, "name", e.target.value)} /></Field>
            <Field label="Date of birth"><input style={inputStyle} type="date" value={s.dob} onChange={(e) => updateStudent(i, "dob", e.target.value)} /></Field>
          </div>
          <Field label="Level">
            <select style={inputStyle} value={s.levelId} onChange={(e) => updateStudent(i, "levelId", e.target.value)}>
              <option value="">Unassigned</option>
              {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
        </div>
      ))}

      <Field label="Guardian name"><input style={inputStyle} value={guardianName} onChange={(e) => setGuardianName(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone"><input style={inputStyle} value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} /></Field>
        <Field label="Email"><input style={inputStyle} type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} /></Field>
      </div>

      <div className="flex gap-4 mb-2">
        <label className="flex items-center gap-1.5 text-sm" style={{ color: T.ink }}>
          <input type="radio" checked={emergencySame} onChange={() => setEmergencySame(true)} /> Emergency: same as guardian
        </label>
        <label className="flex items-center gap-1.5 text-sm" style={{ color: T.ink }}>
          <input type="radio" checked={!emergencySame} onChange={() => setEmergencySame(false)} /> Different
        </label>
      </div>
      {!emergencySame && (
        <div className="grid grid-cols-2 gap-3 mb-2">
          <Field label="Emergency name"><input style={inputStyle} value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} /></Field>
          <Field label="Emergency phone"><input style={inputStyle} value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} /></Field>
        </div>
      )}

      <p style={{ fontSize: 12, color: request.video_consent ? T.sage : T.inkSoft, marginBottom: 6 }}>
        Video/photo consent: {request.video_consent ? "Given ✓" : "Not given"}
      </p>
      {request.notes && <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10 }}><strong>Note from parent:</strong> {request.notes}</p>}
      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <div className="flex justify-end gap-2 mt-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={approve} disabled={saving}>{saving ? "Creating…" : `Approve & create ${students.length > 1 ? `${students.length} students` : "student"}`}</Btn>
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
      supabase.from("enrollment_requests").select("*, enrollment_request_students(*)").order("created_at", { ascending: false }),
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
          {pendingCount} pending request{pendingCount === 1 ? "" : "s"}. Share your public form link: <code style={{ background: T.paper, padding: "2px 6px", borderRadius: 4 }}>{window.location.origin}/enroll</code>
        </p>
        <button onClick={() => setShowHandled((v) => !v)} style={{ fontSize: 12, color: showHandled ? T.maroon : T.inkSoft, fontWeight: showHandled ? 600 : 400, whiteSpace: "nowrap" }}>
          {showHandled ? "← Back to pending" : "View approved/rejected"}
        </button>
      </div>

      {filtered.length === 0 && <p style={{ color: T.inkSoft }}>{showHandled ? "No handled requests yet." : "No pending requests."}</p>}

      <div className="grid gap-3">
        {filtered.map((r) => {
          const kids = (r.enrollment_request_students || []).slice().sort((a, b) => a.sort_order - b.sort_order);
          return (
            <div key={r.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${r.status === "pending" ? T.gold : r.status === "approved" ? T.sage : T.terracotta}`, borderRadius: 8, padding: 14 }}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  {kids.map((k) => (
                    <div key={k.id} style={{ fontFamily: "Fraunces, serif", fontSize: 15, color: T.maroonDark }}>
                      {k.student_name} {k.is_sibling && <span style={{ fontSize: 11, color: T.inkSoft, fontFamily: "Inter, sans-serif" }}>(sibling)</span>}
                      {k.student_dob && <span style={{ fontSize: 11, color: T.inkSoft, fontFamily: "Inter, sans-serif", marginLeft: 6 }}>· DOB {k.student_dob}</span>}
                    </div>
                  ))}
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>
                    {r.guardian_name} · {r.guardian_phone}{r.guardian_email ? ` · ${r.guardian_email}` : ""}
                  </div>
                  <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
                    Emergency: {r.emergency_same ? "same as guardian" : `${r.emergency_name} · ${r.emergency_phone}`}
                    {" · "}Video consent: <span style={{ color: r.video_consent ? T.sage : T.terracotta, fontWeight: 600 }}>{r.video_consent ? "Yes" : "No"}</span>
                  </div>
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
          );
        })}
      </div>

      {approving && <ApproveModal request={approving} levels={levels} onClose={() => setApproving(null)} onApproved={() => { setApproving(null); load(); }} />}
      {confirmReject && (
        <ConfirmModal
          title="Reject this request?"
          message="All students in this request will be marked rejected. No student records are created."
          confirmLabel="Reject"
          onConfirm={() => reject(confirmReject.id)}
          onCancel={() => setConfirmReject(null)}
        />
      )}
    </div>
  );
}
