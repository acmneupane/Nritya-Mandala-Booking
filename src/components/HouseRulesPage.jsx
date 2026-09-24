import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { useLogoUrl } from "../lib/logo";
import { HouseRulesSections } from "./HouseRules";

// Standalone version of the enrolment form's "Important Information" panel —
// same content, linked from the Renewal and Transfer forms (which don't show
// it inline) and from the Terms & Conditions, which incorporates it by
// reference. There's no "Requested time" line here since no class has
// necessarily been selected on this page.
export default function HouseRulesPage() {
  const logoUrl = useLogoUrl();
  const [studioAddress, setStudioAddress] = useState("72 Central Avenue, Oran Park, NSW 2570");

  useEffect(() => {
    supabase.from("admin_settings").select("studio_address").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data?.studio_address) setStudioAddress(data.studio_address);
    });
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: T.ivory, fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px 60px" }}>
        <a href="/" style={{ display: "inline-block", marginBottom: 20 }}>
          <img src={logoUrl} alt="" style={{ width: 52, height: 52, borderRadius: "50%", display: "block" }} />
        </a>
        <h1 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 28, color: T.maroonDark, fontWeight: 600, marginBottom: 8 }}>House Rules</h1>
        <p style={{ fontSize: 13, color: T.inkSoft, marginBottom: 28 }}>Practical policies for enrolled students and their families — please read alongside our <a href="/terms" style={{ color: T.gold, fontWeight: 600, textDecoration: "underline" }}>Terms &amp; Conditions</a>.</p>
        <div className="rounded-2xl shadow-[0_2px_10px_-4px_rgba(36,27,21,0.1)]" style={{ background: "#fff", border: `1px solid ${T.line}`, padding: 22 }}>
          <HouseRulesSections studioAddress={studioAddress} locationExtra={null} />
        </div>
        <a href="/" style={{ display: "inline-block", marginTop: 24, fontSize: 13, color: T.gold, fontWeight: 600 }}>← Back to home</a>
      </div>
    </div>
  );
}
