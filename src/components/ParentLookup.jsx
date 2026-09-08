import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { LOGO_DATA_URI } from "../lib/logo";
import { Btn } from "./ui";
import ParentView from "./ParentView";

export default function ParentLookup() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(false);

  const lookup = async (rawCode) => {
    setError("");
    setLoading(true);
    const { data, error } = await supabase
      .from("student_public")
      .select("id, code, name, level_id")
      .eq("code", rawCode.trim().toUpperCase())
      .maybeSingle();
    setLoading(false);
    if (error || !data) { setError("Code not found — check with the studio."); return; }
    setStudent(data);
  };

  // A QR scan lands here with ?code=XXXX already filled in — skip the typing step.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qCode = params.get("code");
    if (qCode) { setCode(qCode); lookup(qCode); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = () => lookup(code);

  if (student) return <ParentView student={student} onBack={() => setStudent(null)} />;

  return (
    <div style={{ minHeight: "100vh", background: T.maroon, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: T.ivory, borderRadius: 12, padding: "40px 36px", width: 340, textAlign: "center" }}>
        <img src={LOGO_DATA_URI} alt="Nritya Mandala" style={{ width: 68, height: 68, borderRadius: "50%", margin: "0 auto 16px", display: "block" }} />
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: T.maroonDark, marginBottom: 4 }}>Nritya Mandala</h1>
        <p style={{ fontSize: 13, color: T.inkSoft, marginBottom: 24 }}>Enter your child's code to see their bookings</p>
        <input
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(""); }}
          placeholder="Code"
          style={{ ...inputStyle, textAlign: "center", letterSpacing: 4, fontSize: 18, textTransform: "uppercase", marginBottom: 16 }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
        />
        {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <Btn onClick={submit} size="lg" disabled={loading}>{loading ? "Looking up…" : "View"}</Btn>
      </div>
    </div>
  );
}
