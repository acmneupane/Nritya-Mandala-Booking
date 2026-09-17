import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { LOGO_DATA_URI } from "../lib/logo";
import { Btn } from "./ui";
import ParentView from "./ParentView";

export default function ParentLookup() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [archived, setArchived] = useState(false);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(false);

  const lookup = async (rawCode) => {
    setError("");
    setArchived(false);
    setLoading(true);
    const { data } = await supabase
      .from("student_public")
      .select("id, code, name, level_id")
      .eq("code", rawCode.trim().toUpperCase())
      .maybeSingle();
    if (data) {
      setLoading(false);
      setStudent(data);
      return;
    }
    const { data: status } = await supabase.rpc("check_student_code", { p_code: rawCode.trim() });
    setLoading(false);
    if (status === "archived") {
      setArchived(true);
    } else {
      setError("Code not found — check with the studio.");
    }
  };

  // A QR scan lands here with ?code=XXXX already filled in — skip the typing step.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qCode = params.get("code");
    if (qCode) { setCode(qCode); lookup(qCode); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = () => lookup(code);

  if (student) return <ParentView student={student} onBack={() => setStudent(null)} onSwitchStudent={setStudent} />;

  return (
    <div style={{ minHeight: "100vh", background: T.maroon, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: T.ivory, borderRadius: 12, padding: "40px 36px", width: 340, textAlign: "center" }}>
        <img src={LOGO_DATA_URI} alt="Nritya Mandala" style={{ width: 68, height: 68, borderRadius: "50%", margin: "0 auto 16px", display: "block" }} />
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: T.maroonDark, marginBottom: 4 }}>Nritya Mandala</h1>
        <p style={{ fontSize: 13, color: T.inkSoft, marginBottom: 24 }}>Enter your student's code to see their bookings</p>
        <input
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(""); setArchived(false); }}
          placeholder="Code"
          style={{ ...inputStyle, textAlign: "center", letterSpacing: 4, fontSize: 18, textTransform: "uppercase", marginBottom: 16 }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
        />
        {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 12 }}>{error}</p>}
        {archived && (
          <div style={{ background: `${T.gold}18`, border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "12px 14px", marginBottom: 16, textAlign: "left" }}>
            <p style={{ fontSize: 13, color: T.ink, lineHeight: 1.5, marginBottom: 8 }}>
              🪷 Looks like you've taken a break from dancing with us! We'd love to have you back — head over to re-enrol and we'll get you set up again.
            </p>
            <a href="/enroll" style={{ fontSize: 13, color: T.gold, fontWeight: 600, textDecoration: "underline" }}>Re-enrol here</a>
          </div>
        )}
        <Btn onClick={submit} size="lg" disabled={loading}>{loading ? "Looking up…" : "View"}</Btn>
      </div>
    </div>
  );
}
