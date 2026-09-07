import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { LOGO_DATA_URI } from "../lib/logo";
import { Btn, Field } from "./ui";

export default function EnrollForm() {
  const [levels, setLevels] = useState([]);
  const [studentName, setStudentName] = useState("");
  const [studentAge, setStudentAge] = useState("");
  const [preferredLevelId, setPreferredLevelId] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("levels").select("id, name").order("order_num").then(({ data }) => setLevels(data || []));
  }, []);

  const submit = async () => {
    if (!studentName.trim() || !guardianName.trim()) {
      setError("Student name and your name are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    const { error } = await supabase.from("enrollment_requests").insert({
      student_name: studentName.trim(),
      student_age: studentAge ? Number(studentAge) : null,
      preferred_level_id: preferredLevelId || null,
      guardian_name: guardianName.trim(),
      guardian_phone: guardianPhone.trim(),
      guardian_email: guardianEmail.trim(),
      notes: notes.trim(),
      status: "pending",
    });
    setSubmitting(false);
    if (error) { setError("Something went wrong submitting — please try again."); return; }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: T.maroon, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", padding: 16 }}>
        <div style={{ background: T.ivory, borderRadius: 12, padding: "40px 28px", width: "100%", maxWidth: 380, textAlign: "center", boxSizing: "border-box" }}>
          <img src={LOGO_DATA_URI} alt="" style={{ width: 60, height: 60, borderRadius: "50%", margin: "0 auto 16px", display: "block" }} />
          <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.maroonDark, marginBottom: 8 }}>Thank you!</h1>
          <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6 }}>
            We've received {studentName}'s enrolment request. The studio will review it and get back to you shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.maroon, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", padding: 16 }}>
      <div style={{ background: T.ivory, borderRadius: 12, padding: "32px 24px", width: "100%", maxWidth: 420, boxSizing: "border-box" }}>
        <div className="flex items-center gap-2 mb-4">
          <img src={LOGO_DATA_URI} alt="" style={{ width: 44, height: 44, borderRadius: "50%" }} />
          <div>
            <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 19, color: T.maroonDark }}>Enrol a student</h1>
            <p style={{ fontSize: 12, color: T.inkSoft }}>Nritya Mandala</p>
          </div>
        </div>

        <Field label="Student's name *"><input style={inputStyle} value={studentName} onChange={(e) => setStudentName(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Age"><input style={inputStyle} type="number" min={2} value={studentAge} onChange={(e) => setStudentAge(e.target.value)} /></Field>
          <Field label="Preferred level">
            <select style={inputStyle} value={preferredLevelId} onChange={(e) => setPreferredLevelId(e.target.value)}>
              <option value="">Not sure</option>
              {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Your name *"><input style={inputStyle} value={guardianName} onChange={(e) => setGuardianName(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><input style={inputStyle} value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} /></Field>
          <Field label="Email"><input style={inputStyle} type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} /></Field>
        </div>
        <Field label="Anything else we should know?"><textarea style={{ ...inputStyle, minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Prior dance experience, scheduling constraints, etc." /></Field>

        {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 10 }}>{error}</p>}
        <Btn onClick={submit} size="lg" disabled={submitting}>{submitting ? "Submitting…" : "Submit request"}</Btn>
        <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 14 }}>
          <a href="/parent" style={{ color: T.inkSoft, textDecoration: "underline" }}>Already enrolled? Look up bookings</a>
        </p>
      </div>
    </div>
  );
}
