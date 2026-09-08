import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { LOGO_DATA_URI } from "../lib/logo";
import { Btn } from "./ui";
import { drawQrWithLogo, buildQrCardDataUrl } from "../lib/qrCard";

export default function QrCard() {
  const canvasRef = useRef(null);
  const [student, setStudent] = useState(undefined); // undefined = loading, null = not found
  const [cardDataUrl, setCardDataUrl] = useState(null);
  const [pkgSummary, setPkgSummary] = useState(null);

  const code = new URLSearchParams(window.location.search).get("code") || "";

  useEffect(() => {
    if (!code) { setStudent(null); return; }
    supabase.from("student_public").select("id, code, name").eq("code", code.trim().toUpperCase()).maybeSingle()
      .then(({ data }) => setStudent(data || null));
  }, [code]);

  useEffect(() => {
    if (!student || !canvasRef.current) return;
    const qrText = `${window.location.origin}/parent?code=${encodeURIComponent(student.code)}`;
    drawQrWithLogo(canvasRef.current, qrText, { size: 240 * 3, withLogo: true });
    buildQrCardDataUrl({ studentName: student.name, code: student.code, qrText }).then(setCardDataUrl);
    supabase.from("student_package_summary").select("classes_total, classes_used").eq("student_id", student.id).maybeSingle()
      .then(({ data }) => setPkgSummary(data));
  }, [student]);

  if (student === undefined) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }

  if (!student) {
    return (
      <div style={{ minHeight: "100vh", background: T.maroon, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", padding: 16 }}>
        <div style={{ background: T.ivory, borderRadius: 12, padding: "36px 28px", width: "100%", maxWidth: 360, textAlign: "center", boxSizing: "border-box" }}>
          <p style={{ color: T.terracotta, fontSize: 14 }}>This link isn't valid — check with the studio for a fresh one.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.maroon, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", padding: 16 }}>
      <div style={{ background: T.ivory, borderRadius: 12, padding: "32px 28px", width: "100%", maxWidth: 380, textAlign: "center", boxSizing: "border-box" }}>
        <img src={LOGO_DATA_URI} alt="" style={{ width: 48, height: 48, borderRadius: "50%", margin: "0 auto 10px", display: "block" }} />
        <p style={{ fontSize: 12, color: T.gold, fontWeight: 600, marginBottom: 4 }}>NRITYA MANDALA</p>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: T.maroonDark, marginBottom: 6 }}>{student.name}</h1>
        <p style={{ fontSize: 13, color: T.inkSoft, marginBottom: 18 }}>Scan this to see bookings & attendance history</p>

        <div style={{ border: `2px solid ${T.gold}`, borderRadius: 10, padding: 12, background: "#fff", display: "inline-block" }}>
          <canvas ref={canvasRef} style={{ width: 220, height: 220, display: "block" }} />
        </div>

        <div style={{ marginTop: 16, background: `${T.gold}18`, border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "10px 20px" }}>
          <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 2 }}>Code</div>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 26, letterSpacing: 4, fontWeight: 700, color: T.maroonDark }}>{student.code}</div>
        </div>

        {pkgSummary && pkgSummary.classes_total > 0 && (() => {
          const remaining = pkgSummary.classes_total - pkgSummary.classes_used;
          return (
            <div style={{ marginTop: 10, background: remaining > 0 ? `${T.sage}18` : `${T.terracotta}18`, border: `1px solid ${remaining > 0 ? T.sage : T.terracotta}55`, borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: remaining > 0 ? T.sage : T.terracotta }}>
              {remaining} class{remaining === 1 ? "" : "es"} remaining on package
            </div>
          );
        })()}

        <div className="flex flex-col gap-2 mt-5">
          {cardDataUrl && (
            <a href={cardDataUrl} download={`${student.name.replace(/\s+/g, "-")}-qr-card.png`}>
              <Btn size="lg">Download QR code</Btn>
            </a>
          )}
          <a href={`/parent?code=${encodeURIComponent(student.code)}`}>
            <Btn variant="ghost" size="lg">View bookings now</Btn>
          </a>
        </div>
      </div>
    </div>
  );
}
