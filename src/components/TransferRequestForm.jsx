import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { useLogoUrl } from "../lib/logo";
import { Btn, Field, Select } from "./ui";
import TurnstileWidget from "./TurnstileWidget";
import { formatTimeRange, compareClassSchedule } from "../lib/scheduling";
import { fetchOpenClasses, classOptionLabel } from "../lib/classAvailability";
import { localDateStr } from "../lib/dates";

const RELATION_OPTIONS = ["Mother", "Father", "Guardian", "Grandparent", "Other"];

export default function TransferRequestForm() {
  const logoUrl = useLogoUrl();
  const today = localDateStr(new Date());
  const code = new URLSearchParams(window.location.search).get("code") || "";
  const [student, setStudent] = useState(undefined); // undefined = loading, null = not found
  const [studentName, setStudentName] = useState("");
  const [studentDob, setStudentDob] = useState("");
  const [currentClassIds, setCurrentClassIds] = useState([]);
  const [currentClassObjs, setCurrentClassObjs] = useState([]); // full class info for whatever they're already in, regardless of capacity
  const [openClasses, setOpenClasses] = useState([]); // classes with room to transfer into
  const [newClassId, setNewClassId] = useState("");
  const [guardians, setGuardians] = useState([]);
  const [requesterId, setRequesterId] = useState(""); // guardian_id, or "new"
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRelation, setNewRelation] = useState("");
  const [newIsEmergency, setNewIsEmergency] = useState(null); // true/false, unanswered = null
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!code) { setStudent(null); return; }
    const upperCode = code.trim().toUpperCase();
    Promise.all([
      supabase.from("student_public").select("id, code, name, dob").eq("code", upperCode).maybeSingle(),
      fetchOpenClasses(),
      supabase.rpc("get_student_guardians", { p_code: upperCode }),
    ]).then(([sRes, open, gRes]) => {
      if (!sRes.data) { setStudent(null); return; }
      setStudent(sRes.data);
      setStudentName(sRes.data.name);
      setStudentDob(sRes.data.dob || "");
      setOpenClasses(open.slice().sort(compareClassSchedule));
      setGuardians(gRes.data || []);
      supabase.from("enrollments").select("class_id, classes(id, label, day, time, end_time)").eq("student_id", sRes.data.id).then(({ data }) => {
        setCurrentClassIds((data || []).map((e) => e.class_id));
        setCurrentClassObjs((data || []).map((e) => e.classes).filter(Boolean));
        setLoaded(true);
      });
    });
  }, [code]);

  const availableClasses = openClasses.filter((c) => !currentClassIds.includes(c.id));
  const noAvailableClasses = loaded && availableClasses.length === 0;

  const submit = async () => {
    if (!studentName.trim()) { setError("Student's name can't be blank."); return; }
    if (!newClassId) { setError("Please select which class to transfer to."); return; }
    if (!requesterId) { setError("Please let us know who's requesting this."); return; }
    if (requesterId === "new" && (!newName.trim() || !newPhone.trim())) { setError("Please provide your name and phone number."); return; }
    if (requesterId === "new" && newIsEmergency === null) { setError("Please let us know if you're the emergency contact for this student."); return; }

    setSubmitting(true);
    setError("");
    try {
      let requester, isEmergency;
      if (requesterId === "new") {
        requester = { name: newName.trim(), phone: newPhone.trim(), email: newEmail.trim(), relation: newRelation || "Other" };
        isEmergency = newIsEmergency;
      } else {
        const g = guardians.find((x) => x.guardian_id === requesterId);
        requester = { name: g.name, phone: g.phone || "", email: g.email || "", relation: g.relation || "Other" };
        isEmergency = g.is_emergency;
      }

      const { data: fnData, error: fnErr } = await supabase.functions.invoke("submit-form", {
        body: {
          turnstileToken,
          formType: "enrollment",
          params: {
            p_guardian_name: requester.name,
            p_guardian_relation: requester.relation,
            p_guardian_email: requester.email,
            p_guardian_phone: requester.phone,
            p_emergency_same: isEmergency,
            p_emergency_name: "",
            p_emergency_phone: "",
            p_video_consent: null,
            p_notes: notes.trim() || null,
            p_students: [{ name: studentName.trim(), dob: studentDob || null, preferred_class_id: newClassId, is_sibling: false, sort_order: 0 }],
            p_is_transfer: true,
            p_transfer_student_code: student.code,
          },
        },
      });
      if (fnErr || !fnData?.ok) throw new Error(fnData?.error || "Something went wrong submitting — please try again.");
      setDone(true);
    } catch (e) {
      setError(e.message || "Something went wrong submitting — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (student === undefined) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }
  if (!student) {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${T.maroon}, ${T.maroonDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", padding: 16 }}>
        <div className="rounded-[1.75rem] shadow-2xl" style={{ background: T.ivory, padding: "36px 28px", width: "100%", maxWidth: 360, textAlign: "center", boxSizing: "border-box" }}>
          <p style={{ color: T.terracotta, fontSize: 14 }}>This link isn't valid — check with the studio for a fresh one.</p>
        </div>
      </div>
    );
  }
  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${T.maroon}, ${T.maroonDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", padding: 16 }}>
        <div className="rounded-[1.75rem] shadow-2xl" style={{ background: T.ivory, padding: "40px 28px", width: "100%", maxWidth: 380, textAlign: "center", boxSizing: "border-box" }}>
          <a href="/" className="hover:opacity-90 transition-opacity" style={{ display: "inline-block", marginBottom: 16 }}>
            <img src={logoUrl} alt="" style={{ width: 72, height: 72, borderRadius: "50%", display: "block" }} />
          </a>
          <h1 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: T.maroonDark, marginBottom: 8, fontWeight: 600 }}>Thank you!</h1>
          <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6 }}>We've received your class transfer request. The studio will review it and confirm once it's actioned.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${T.maroon}, ${T.maroonDark})`, padding: "28px 16px" }} className="sm:py-12">
      <div className="max-w-[460px] sm:max-w-[560px] md:max-w-[680px] lg:max-w-[780px] mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <a href="/" className="hover:opacity-90 transition-opacity shrink-0">
            <img src={logoUrl} alt="" style={{ width: 64, height: 64, borderRadius: "50%", boxShadow: "0 4px 14px rgba(0,0,0,0.25)", display: "block" }} />
          </a>
          <div>
            <h1 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: "#fff", fontWeight: 600, textShadow: "0 2px 10px rgba(0,0,0,0.2)" }}>Request a class change</h1>
            <p style={{ fontSize: 12.5, color: T.goldLight, fontWeight: 600 }}>Nritya Mandala</p>
          </div>
        </div>

        <div className="rounded-[1.75rem] shadow-2xl sm:p-10" style={{ background: T.ivory, padding: "26px 20px", boxSizing: "border-box", fontFamily: "Inter, sans-serif" }}>
          <h3 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark, marginBottom: 6, fontWeight: 600 }}>Is this correct?</h3>
          <p style={{ fontSize: 12.5, color: T.inkSoft, marginBottom: 14 }}>Update anything below that isn't right.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Student's name"><input style={inputStyle} value={studentName} onChange={(e) => setStudentName(e.target.value)} /></Field>
            <Field label="Date of birth"><input style={inputStyle} type="date" value={studentDob} onChange={(e) => setStudentDob(e.target.value)} /></Field>
          </div>
          {currentClassObjs.length > 0 && (
            <p style={{ fontSize: 12, color: T.inkSoft, marginTop: -4, marginBottom: 14 }}>
              Currently in: {currentClassObjs.map((c) => `${c.label} (${c.day} ${formatTimeRange(c.time, c.end_time)})`).join(", ")}
            </p>
          )}

          {noAvailableClasses ? (
            <p style={{ fontSize: 13, color: T.terracotta, marginTop: 10 }}>There's no other class available to transfer to right now — please check with the studio directly.</p>
          ) : (
            <>
              <h3 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark, marginBottom: 10, marginTop: 22, fontWeight: 600 }}>Transfer to</h3>
              <Field label="New class">
                <Select value={newClassId} onChange={(e) => setNewClassId(e.target.value)}>
                  <option value="">Select a class…</option>
                  {availableClasses.map((c) => <option key={c.id} value={c.id}>{c.label} — {classOptionLabel(c, today)}</option>)}
                </Select>
              </Field>

              <h3 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark, marginBottom: 10, marginTop: 22, fontWeight: 600 }}>Who's requesting this?</h3>
              <Field label="Requested by">
                <Select value={requesterId} onChange={(e) => setRequesterId(e.target.value)}>
                  <option value="">Select…</option>
                  {guardians.map((g) => <option key={g.guardian_id} value={g.guardian_id}>{g.name}{g.relation ? ` (${g.relation})` : ""}{g.is_emergency ? " — Emergency Contact" : ""}</option>)}
                  <option value="new">Someone else</option>
                </Select>
              </Field>
              {requesterId === "new" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Your name"><input style={inputStyle} value={newName} onChange={(e) => setNewName(e.target.value)} /></Field>
                    <Field label="Your phone"><input style={inputStyle} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} /></Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Your email"><input style={inputStyle} type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></Field>
                    <Field label="Relation to student">
                      <Select value={newRelation} onChange={(e) => setNewRelation(e.target.value)}>
                        <option value="">Select…</option>
                        {RELATION_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </Select>
                    </Field>
                  </div>
                  <Field label={`Are you the emergency contact for ${studentName || "this student"}?`}>
                    <div className="flex gap-4" style={{ fontSize: 13, color: T.ink }}>
                      <label className="flex items-center gap-1.5"><input type="radio" checked={newIsEmergency === true} onChange={() => setNewIsEmergency(true)} /> Yes</label>
                      <label className="flex items-center gap-1.5"><input type="radio" checked={newIsEmergency === false} onChange={() => setNewIsEmergency(false)} /> No</label>
                    </div>
                  </Field>
                </>
              )}

              <Field label="Anything else?"><textarea style={{ ...inputStyle, minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>

              <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${T.gold}33` }}>
                {error && <p style={{ color: T.terracotta, fontSize: 16, fontWeight: 700, textAlign: "center", marginBottom: 10, lineHeight: 1.4 }}>{error}</p>}
                <TurnstileWidget onVerify={setTurnstileToken} />
                <div style={{ marginTop: 10, textAlign: "right" }}>
                  <Btn variant="success" onClick={submit} size="lg" disabled={submitting || !turnstileToken}>{submitting ? "Submitting…" : "Submit request"}</Btn>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
