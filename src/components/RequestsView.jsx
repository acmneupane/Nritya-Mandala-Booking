import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Field, Modal, ConfirmModal } from "./ui";
import { generateStudentCode } from "../lib/studentCode";
import { formatTimeRange, nextOccurrenceOf } from "../lib/scheduling";
import { localDateStr } from "../lib/dates";
import EmailPreviewModal from "./EmailPreviewModal";
import PendingPackagesEditor from "./PendingPackagesEditor";

function ApproveModal({ request, levels, classes, classById, skips, tierById, onClose, onApproved }) {
  const [students, setStudents] = useState(
    (request.enrollment_request_students || [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => {
        const selectedTier = s.selected_package_tier_id ? tierById[s.selected_package_tier_id] : null;
        const isSiblingPrice = !!(selectedTier && s.is_sibling && selectedTier.sibling_price != null);
        const tierPrice = selectedTier ? (isSiblingPrice ? Number(selectedTier.sibling_price) : Number(selectedTier.price)) : 0;
        return {
          id: s.id, name: s.student_name, dob: s.student_dob || "", levelId: "", preferredClassId: s.preferred_class_id || "", isSibling: s.is_sibling,
          pendingPackages: selectedTier ? [{ classesTotal: selectedTier.classes_count, amount: tierPrice, note: `Requested at enrolment: ${selectedTier.name}`, isSiblingPrice }] : [],
        };
      })
  );
  const [guardianName, setGuardianName] = useState(request.guardian_name);
  const [guardianPhone, setGuardianPhone] = useState(request.guardian_phone || "");
  const [guardianEmail, setGuardianEmail] = useState(request.guardian_email || "");
  const [emergencySame, setEmergencySame] = useState(request.emergency_same);
  const [emergencyName, setEmergencyName] = useState(request.emergency_name || "");
  const [emergencyPhone, setEmergencyPhone] = useState(request.emergency_phone || "");
  const [paymentConfirmed, setPaymentConfirmed] = useState(request.payment_claimed || false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [fees, setFees] = useState({ enabled: false, primary: 0, sibling: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dirtyPackages, setDirtyPackages] = useState({}); // { [studentIndex]: boolean }
  const [confirmDirtyPackage, setConfirmDirtyPackage] = useState(false);

  useEffect(() => {
    supabase.from("settings").select("enrolment_fee_enabled, enrolment_fee_primary, enrolment_fee_sibling").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setFees({ enabled: data.enrolment_fee_enabled, primary: Number(data.enrolment_fee_primary), sibling: Number(data.enrolment_fee_sibling) });
    });
  }, []);

  const updateStudent = (i, field, val) => setStudents((ss) => ss.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)));
  const setStudentPackages = (i) => (updater) => {
    setStudents((ss) => ss.map((s, idx) => {
      if (idx !== i) return s;
      const next = typeof updater === "function" ? updater(s.pendingPackages || []) : updater;
      return { ...s, pendingPackages: next };
    }));
  };

  const handleApproveClick = () => {
    if (Object.values(dirtyPackages).some(Boolean)) {
      setConfirmDirtyPackage(true);
      return;
    }
    approve();
  };

  const approve = async () => {
    setSaving(true);
    setError("");
    try {
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

      const emailStudents = [];
      for (const s of students) {
        const code = await generateStudentCode(supabase, s.name);
        const { data: created, error: sErr } = await supabase.from("students").insert({
          name: s.name.trim(), dob: s.dob || null, level_id: s.levelId || null, code, video_consent: request.video_consent,
        }).select().single();
        if (sErr) throw sErr;

        await supabase.from("student_guardians").insert({
          student_id: created.id, guardian_id: primaryGuardian.id, relation: request.guardian_relation || "Guardian", emergency: emergencySame,
        });
        if (emergencyGuardian) {
          await supabase.from("student_guardians").insert({
            student_id: created.id, guardian_id: emergencyGuardian.id, relation: "Emergency contact", emergency: true,
          });
        }
        // Book them straight into the class they said they preferred, if any —
        // starting from the class's actual next occurrence, so they don't
        // retroactively show up on past dates' rosters.
        const bookedClass = s.preferredClassId ? classById[s.preferredClassId] : null;
        const nextOcc = bookedClass ? nextOccurrenceOf(bookedClass, skips, localDateStr) : null;
        if (s.preferredClassId) {
          await supabase.from("enrollments").insert({ student_id: created.id, class_id: s.preferredClassId, start_date: nextOcc?.dateStr || localDateStr(new Date()) });
        }
        await supabase.from("enrollment_request_students").update({ created_student_id: created.id }).eq("id", s.id);

        for (const p of s.pendingPackages || []) {
          await supabase.from("packages").insert({
            student_id: created.id, classes_total: p.classesTotal, amount: p.amount, notes: p.note,
            payment_confirmed: paymentConfirmed, payment_method: paymentMethod || null, is_sibling_price: !!p.isSiblingPrice,
            enrollment_request_student_id: s.id,
          });
        }

        if (fees.enabled) {
          await supabase.from("enrolment_fee_charges").insert({
            student_id: created.id, amount: s.isSibling ? fees.sibling : fees.primary, is_sibling: s.isSibling,
            payment_confirmed: paymentConfirmed, payment_method: paymentMethod || null,
            enrollment_request_student_id: s.id,
          });
        }

        emailStudents.push({
          id: created.id,
          name: s.name.trim(), code,
          day: bookedClass?.day || null,
          startDate: nextOcc?.dateStr || bookedClass?.start_date || null,
          time: bookedClass?.time || null,
          endTime: bookedClass?.end_time || null,
        });
      }

      const { error: updErr } = await supabase.from("enrollment_requests").update({
        status: "approved", reviewed_at: new Date().toISOString(),
      }).eq("id", request.id);
      if (updErr) throw updErr;

      onApproved({ guardianEmail: request.guardian_email, emailStudents });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Modal title={`Approve enrolment · ${request.reference}`} onClose={onClose} wide>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 12 }}>Review and adjust before creating {students.length > 1 ? "these student records" : "this student record"}.</p>

      {students.map((s, i) => (
        <div key={s.id} style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.inkSoft, marginBottom: 6 }}>{s.isSibling ? "Additional Student" : "Primary student"}</div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Name"><input style={inputStyle} value={s.name} onChange={(e) => updateStudent(i, "name", e.target.value)} /></Field>
            <Field label="Date of birth"><input style={inputStyle} type="date" value={s.dob} onChange={(e) => updateStudent(i, "dob", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Level (optional)">
              <select style={inputStyle} value={s.levelId} onChange={(e) => updateStudent(i, "levelId", e.target.value)}>
                <option value="">Unassigned</option>
                {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
            <Field label="Book into class">
              <select style={inputStyle} value={s.preferredClassId} onChange={(e) => updateStudent(i, "preferredClassId", e.target.value)}>
                <option value="">Don't book yet</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.label} — {c.day} {formatTimeRange(c.time, c.end_time)}</option>)}
              </select>
            </Field>
          </div>
          {s.preferredClassId && classById[s.preferredClassId] && (
            <p style={{ fontSize: 11, color: T.sage }}>Requested: {classById[s.preferredClassId].label} — {classById[s.preferredClassId].day} {formatTimeRange(classById[s.preferredClassId].time, classById[s.preferredClassId].end_time)}</p>
          )}
          <PendingPackagesEditor pendingPackages={s.pendingPackages || []} setPendingPackages={setStudentPackages(i)} onDirtyChange={(dirty) => setDirtyPackages((d) => ({ ...d, [i]: dirty }))} showPayment={false} />
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

      <div style={{ background: T.paper, borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <label className="flex items-center gap-2 mb-2" style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>
          <input type="checkbox" checked={paymentConfirmed} onChange={(e) => setPaymentConfirmed(e.target.checked)} />
          Payment confirmed {request.payment_claimed ? "(parent marked as paid)" : ""}
        </label>
        {paymentConfirmed && (
          <Field label="Payment method">
            <select style={inputStyle} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="">Not specified</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>
          </Field>
        )}
      </div>

      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <div className="flex justify-end gap-2 mt-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="success" onClick={handleApproveClick} disabled={saving}>{saving ? "Creating…" : `Approve & create ${students.length > 1 ? `${students.length} students` : "student"}`}</Btn>
      </div>
    </Modal>
    {confirmDirtyPackage && (
      <ConfirmModal
        title="Unsaved package changes"
        message="One of the students has a package entry that hasn't been saved yet — if you continue, it will be lost. Go back and click Save changes / Add package first, or continue without it?"
        confirmLabel="Continue without saving it"
        onConfirm={() => { setConfirmDirtyPackage(false); approve(); }}
        onCancel={() => setConfirmDirtyPackage(false)}
      />
    )}
    </>
  );
}

export default function RequestsView({ focusRequestId }) {
  const [requests, setRequests] = useState([]);
  const [levels, setLevels] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classById, setClassById] = useState({});
  const [skips, setSkips] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [tierById, setTierById] = useState({});
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(null);
  const [confirmReject, setConfirmReject] = useState(null);
  const [showHandled, setShowHandled] = useState(false);
  const [emailPreview, setEmailPreview] = useState(null);
  const focusRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [rRes, lRes, cRes, skRes, tRes] = await Promise.all([
      supabase.from("enrollment_requests").select("*, enrollment_request_students(*)").order("created_at", { ascending: false }),
      supabase.from("levels").select("*").order("order_num"),
      supabase.from("classes").select("*"),
      supabase.from("class_skips").select("class_id, date"),
      supabase.from("package_tiers").select("*"),
    ]);
    setRequests(rRes.data || []);
    setLevels(lRes.data || []);
    setClasses(cRes.data || []);
    setClassById(Object.fromEntries((cRes.data || []).map((c) => [c.id, c])));
    setSkips(skRes.data || []);
    setTiers(tRes.data || []);
    setTierById(Object.fromEntries((tRes.data || []).map((t) => [t.id, t])));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // A link from the notification email lands here with a specific request in mind —
  // make sure it's actually visible (switch views if it's already been handled) and
  // scroll it into view.
  useEffect(() => {
    if (!focusRequestId || requests.length === 0) return;
    const target = requests.find((r) => r.id === focusRequestId);
    if (target && target.status !== "pending" && !showHandled) setShowHandled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequestId, requests]);

  useEffect(() => {
    if (focusRef.current) focusRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  const viewScreenshot = async (path) => {
    const { data, error } = await supabase.storage.from("payment-screenshots").createSignedUrl(path, 300);
    if (error || !data) { alert("Couldn't load the screenshot."); return; }
    window.open(data.signedUrl, "_blank");
  };

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
          const isFocused = r.id === focusRequestId;
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
                  <div style={{ fontSize: 11, color: T.gold, fontWeight: 700, letterSpacing: 0.5, marginBottom: 2 }}>{r.reference}</div>
                  {kids.map((k) => (
                    <div key={k.id} style={{ fontFamily: "Fraunces, serif", fontSize: 15, color: T.maroonDark }}>
                      {k.student_name} {k.is_sibling && <span style={{ fontSize: 11, color: T.inkSoft, fontFamily: "Inter, sans-serif" }}>(additional student)</span>}
                      {k.student_dob && <span style={{ fontSize: 11, color: T.inkSoft, fontFamily: "Inter, sans-serif", marginLeft: 6 }}>· DOB {k.student_dob}</span>}
                      {k.preferred_class_id && classById[k.preferred_class_id] ? (
                        <span style={{ fontSize: 11, color: T.sage, fontFamily: "Inter, sans-serif", marginLeft: 6 }}>· wants {classById[k.preferred_class_id].label}</span>
                      ) : k.preferred_class_text ? (
                        <span style={{ fontSize: 11, color: T.gold, fontFamily: "Inter, sans-serif", marginLeft: 6 }}>· preferred: {k.preferred_class_text}</span>
                      ) : null}
                      {k.selected_package_tier_id && tierById[k.selected_package_tier_id] && (
                        <span style={{ fontSize: 11, color: T.maroon, fontFamily: "Inter, sans-serif", marginLeft: 6 }}>
                          · package: {tierById[k.selected_package_tier_id].name} (${(k.is_sibling && tierById[k.selected_package_tier_id].sibling_price != null ? Number(tierById[k.selected_package_tier_id].sibling_price) : Number(tierById[k.selected_package_tier_id].price)).toFixed(2)})
                        </span>
                      )}
                    </div>
                  ))}
                  <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>
                    {r.guardian_name}{r.guardian_relation ? ` (${r.guardian_relation})` : ""} · {r.guardian_phone}{r.guardian_email ? ` · ${r.guardian_email}` : ""}
                  </div>
                  <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
                    Emergency: {r.emergency_same ? "same as guardian" : `${r.emergency_name} · ${r.emergency_phone}`}
                    {" · "}Video consent: <span style={{ color: r.video_consent ? T.sage : T.terracotta, fontWeight: 600 }}>{r.video_consent ? "Yes" : "No"}</span>
                    {" · "}Payment: <span style={{ color: r.payment_claimed ? T.sage : T.inkSoft, fontWeight: 600 }}>{r.payment_claimed ? "Claimed paid" : "Not marked paid"}</span>
                    {r.payment_screenshot_path && (
                      <>
                        {" · "}
                        <button onClick={() => viewScreenshot(r.payment_screenshot_path)} style={{ color: T.gold, textDecoration: "underline" }}>View screenshot</button>
                      </>
                    )}
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

      {approving && (
        <ApproveModal
          request={approving}
          levels={levels}
          classes={classes}
          classById={classById}
          skips={skips}
          tierById={tierById}
          onClose={() => setApproving(null)}
          onApproved={({ guardianEmail, emailStudents }) => {
            setApproving(null);
            load();
            setEmailPreview({ guardianEmail, students: emailStudents });
          }}
        />
      )}
      {emailPreview && (
        <EmailPreviewModal
          guardianEmail={emailPreview.guardianEmail}
          students={emailPreview.students}
          onCancel={() => setEmailPreview(null)}
          onSent={() => { setEmailPreview(null); load(); }}
        />
      )}
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
