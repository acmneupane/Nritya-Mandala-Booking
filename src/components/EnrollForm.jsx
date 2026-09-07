import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { LOGO_DATA_URI } from "../lib/logo";
import { Btn, Field } from "./ui";

const MAX_SIBLINGS = 2;

function InfoSection({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ fontFamily: "Fraunces, serif", fontSize: 14, color: T.maroonDark, marginBottom: 4 }}>{title}</h4>
      <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function ImportantInfo() {
  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 18, marginTop: 20 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark, marginBottom: 12 }}>Important Information</h3>

      <InfoSection title="Location & Time">
        72 Central Avenue, Oran Park, NSW 2570<br />
        6:00 PM – 7:00 PM
      </InfoSection>

      <InfoSection title="Fees">
        Enrolment Fee: $20 per person<br />
        Siblings Fee: $15 per sibling<br />
        5-Week Package: $90 per person<br /><br />
        Fees are payable in advance to secure your child's place in the class.
      </InfoSection>

      <InfoSection title="Bank Account Details">
        Bank: NAB<br />
        Account Name: Sarita Sigdel<br />
        BSB: 082 231<br />
        Account Number: 846746850<br /><br />
        Payment Reference: use the reference number you'll be given after submitting this form.
      </InfoSection>

      <InfoSection title="Payment Confirmation">
        After making the payment, please send a screenshot of your payment confirmation to Nritya Mandala. This helps us confirm and process your enrolment.<br /><br />
        <strong>Your child's place in the class will be confirmed once payment has been received.</strong>
      </InfoSection>

      <InfoSection title="Attendance & Punctuality">
        Please arrive at least 5 minutes before class, ready to dance. Regular attendance is encouraged as it helps students keep up with their routines and make the most of their classes. Please let us know if your child will be absent.
      </InfoSection>

      <InfoSection title="Clothing, Shoes & Hair">
        Students should wear comfortable clothing suitable for dancing, such as activewear. Correctly fitting and comfortable dance shoes should be worn — flip-flops are not permitted. Long hair should be neatly tied back and kept away from the face where possible.
      </InfoSection>

      <InfoSection title="Parents & Guardians">
        Parents and guardians are encouraged to remain outside the dance room during classes. This helps minimise distractions and allows students to focus on learning.
      </InfoSection>

      <InfoSection title="Personal Belongings">
        Please avoid bringing valuables, large amounts of cash or unnecessary personal belongings to class. Nritya Mandala accepts no responsibility for belongings that are lost, damaged or stolen.
      </InfoSection>

      <InfoSection title="Cancellation Policy">
        If your child is unable to attend a class, please notify Nritya Mandala at least 24 hours before the scheduled class. Cancellations made less than 24 hours before the class may not be eligible for a make-up class or credit. We understand that emergencies and unexpected circumstances can happen, and these will be considered on a case-by-case basis. Thank you for helping us manage class spaces and provide the best experience for all students.
      </InfoSection>

      <InfoSection title="Safe & Respectful Environment">
        Nritya Mandala is committed to providing a safe, welcoming and non-discriminatory environment for all students, parents and teachers. Bullying, harassment and disrespectful behaviour are not tolerated.
      </InfoSection>
    </div>
  );
}

function SiblingCard({ sibling, index, classes, onChange, onRemove }) {
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft }}>Sibling {index + 1}</span>
        <button onClick={onRemove} style={{ color: T.terracotta, fontSize: 12 }}>Remove</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Name"><input style={inputStyle} value={sibling.name} onChange={(e) => onChange({ ...sibling, name: e.target.value })} /></Field>
        <Field label="Date of birth"><input style={inputStyle} type="date" value={sibling.dob} onChange={(e) => onChange({ ...sibling, dob: e.target.value })} /></Field>
      </div>
      <Field label="Preferred class">
        <select style={inputStyle} value={sibling.classId} onChange={(e) => onChange({ ...sibling, classId: e.target.value })}>
          <option value="">Not sure</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.label} — {c.day} {c.time}</option>)}
        </select>
      </Field>
    </div>
  );
}

export default function EnrollForm() {
  const [classes, setClasses] = useState([]);
  const [studentName, setStudentName] = useState("");
  const [studentDob, setStudentDob] = useState("");
  const [preferredClassId, setPreferredClassId] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [emergencySame, setEmergencySame] = useState(true);
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [wantsSiblings, setWantsSiblings] = useState(false);
  const [siblings, setSiblings] = useState([]);
  const [videoConsent, setVideoConsent] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("classes").select("id, label, day, time").then(({ data }) => {
      setClasses((data || []).slice().sort((a, b) => a.day.localeCompare(b.day) || a.time.localeCompare(b.time)));
    });
  }, []);

  const addSibling = () => {
    if (siblings.length >= MAX_SIBLINGS) return;
    setSiblings((s) => [...s, { name: "", dob: "", classId: "" }]);
  };
  const updateSibling = (i, val) => setSiblings((s) => s.map((sib, idx) => (idx === i ? val : sib)));
  const removeSibling = (i) => setSiblings((s) => s.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!studentName.trim() || !guardianName.trim()) {
      setError("Student name and your name are required.");
      return;
    }
    if (!emergencySame && (!emergencyName.trim() || !emergencyPhone.trim())) {
      setError("Please provide an emergency contact name and phone, or mark it the same as yours.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const { data: request, error: reqErr } = await supabase.from("enrollment_requests").insert({
        guardian_name: guardianName.trim(),
        guardian_email: guardianEmail.trim(),
        guardian_phone: guardianPhone.trim(),
        emergency_same: emergencySame,
        emergency_name: emergencySame ? "" : emergencyName.trim(),
        emergency_phone: emergencySame ? "" : emergencyPhone.trim(),
        video_consent: videoConsent,
        notes: notes.trim(),
        status: "pending",
      }).select().single();
      if (reqErr) throw reqErr;

      const studentRows = [
        { request_id: request.id, student_name: studentName.trim(), student_dob: studentDob || null, preferred_class_id: preferredClassId || null, is_sibling: false, sort_order: 0 },
        ...siblings.filter((s) => s.name.trim()).map((s, i) => ({
          request_id: request.id, student_name: s.name.trim(), student_dob: s.dob || null, preferred_class_id: s.classId || null, is_sibling: true, sort_order: i + 1,
        })),
      ];
      const { error: studErr } = await supabase.from("enrollment_request_students").insert(studentRows);
      if (studErr) throw studErr;

      setReference(request.reference);
    } catch (e) {
      setError("Something went wrong submitting — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (reference) {
    return (
      <div style={{ minHeight: "100vh", background: T.maroon, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", padding: 16 }}>
        <div style={{ background: T.ivory, borderRadius: 12, padding: "40px 28px", width: "100%", maxWidth: 380, textAlign: "center", boxSizing: "border-box" }}>
          <img src={LOGO_DATA_URI} alt="" style={{ width: 60, height: 60, borderRadius: "50%", margin: "0 auto 16px", display: "block" }} />
          <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.maroonDark, marginBottom: 8 }}>Thank you!</h1>
          <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6, marginBottom: 16 }}>
            We've received {studentName}'s enrolment request. We'll call you back to confirm the enrolment.
          </p>
          <div style={{ background: `${T.gold}18`, border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "14px 18px", marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 2 }}>Your payment reference</div>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, letterSpacing: 1, fontWeight: 700, color: T.maroonDark }}>{reference}</div>
          </div>
          <p style={{ fontSize: 12, color: T.inkSoft, lineHeight: 1.5 }}>Please use this reference when making your payment, and keep it handy in case we need to follow up.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.maroon, padding: "24px 16px" }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <div className="flex items-center gap-2 mb-4">
          <img src={LOGO_DATA_URI} alt="" style={{ width: 44, height: 44, borderRadius: "50%" }} />
          <div>
            <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: T.ivory }}>Enrol a student</h1>
            <p style={{ fontSize: 12, color: T.goldLight }}>Nritya Mandala</p>
          </div>
        </div>

        <div style={{ background: T.ivory, borderRadius: 12, padding: "24px 20px", boxSizing: "border-box", fontFamily: "Inter, sans-serif" }}>
          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 12 }}>Student details</h3>
          <Field label="Student's name *"><input style={inputStyle} value={studentName} onChange={(e) => setStudentName(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date of birth"><input style={inputStyle} type="date" value={studentDob} onChange={(e) => setStudentDob(e.target.value)} /></Field>
            <Field label="Preferred class">
              <select style={inputStyle} value={preferredClassId} onChange={(e) => setPreferredClassId(e.target.value)}>
                <option value="">Not sure</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.label} — {c.day} {c.time}</option>)}
              </select>
            </Field>
          </div>

          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, margin: "18px 0 12px" }}>Who's filling this out?</h3>
          <Field label="Your name *"><input style={inputStyle} value={guardianName} onChange={(e) => setGuardianName(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><input style={inputStyle} type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} /></Field>
            <Field label="Mobile"><input style={inputStyle} value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} /></Field>
          </div>

          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, margin: "18px 0 8px" }}>Emergency contact</h3>
          <div className="flex gap-4 mb-3">
            <label className="flex items-center gap-1.5 text-sm" style={{ color: T.ink }}>
              <input type="radio" checked={emergencySame} onChange={() => setEmergencySame(true)} /> Same as above
            </label>
            <label className="flex items-center gap-1.5 text-sm" style={{ color: T.ink }}>
              <input type="radio" checked={!emergencySame} onChange={() => setEmergencySame(false)} /> Different person
            </label>
          </div>
          {!emergencySame && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name"><input style={inputStyle} value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} /></Field>
              <Field label="Mobile"><input style={inputStyle} value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} /></Field>
            </div>
          )}

          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, margin: "18px 0 8px" }}>Siblings</h3>
          {!wantsSiblings ? (
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-1.5 text-sm" style={{ color: T.ink }}>
                <input type="radio" checked={!wantsSiblings} onChange={() => setWantsSiblings(false)} /> No siblings to add
              </label>
              <label className="flex items-center gap-1.5 text-sm" style={{ color: T.ink }}>
                <input type="radio" checked={wantsSiblings} onChange={() => setWantsSiblings(true)} /> Yes, add siblings
              </label>
            </div>
          ) : (
            <>
              <button onClick={() => setWantsSiblings(false)} style={{ fontSize: 12, color: T.inkSoft, marginBottom: 8, textDecoration: "underline" }}>Actually, no siblings</button>
              {siblings.map((s, i) => (
                <SiblingCard key={i} sibling={s} index={i} classes={classes} onChange={(val) => updateSibling(i, val)} onRemove={() => removeSibling(i)} />
              ))}
              {siblings.length < MAX_SIBLINGS && (
                <Btn size="sm" variant="ghost" onClick={addSibling}>+ Add sibling ({siblings.length}/{MAX_SIBLINGS})</Btn>
              )}
            </>
          )}

          <Field label="Anything else we should know?"><textarea style={{ ...inputStyle, minHeight: 60, marginTop: 14 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Prior dance experience, scheduling constraints, etc." /></Field>

          <label className="flex items-start gap-2 mt-3 mb-2" style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.5 }}>
            <input type="checkbox" checked={videoConsent} onChange={(e) => setVideoConsent(e.target.checked)} style={{ marginTop: 2 }} />
            <span>I consent to photos/videos of my child taken during class being used by Nritya Mandala for social media.</span>
          </label>

          <p style={{ fontSize: 12, color: T.inkSoft, marginTop: 8 }}>Once submitted, we'll call you back to confirm the enrolment — you'll also be given a reference number to use for payment.</p>

          {error && <p style={{ color: T.terracotta, fontSize: 13, marginTop: 10 }}>{error}</p>}
          <div style={{ marginTop: 14 }}>
            <Btn onClick={submit} size="lg" disabled={submitting}>{submitting ? "Submitting…" : "Submit request"}</Btn>
          </div>
          <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 14 }}>
            <a href="/parent" style={{ color: T.inkSoft, textDecoration: "underline" }}>Already enrolled? Look up bookings</a>
          </p>

          <ImportantInfo />
        </div>
      </div>
    </div>
  );
}
