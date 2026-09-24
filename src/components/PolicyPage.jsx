import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { useLogoUrl } from "../lib/logo";

// Renders whichever legal document (Privacy Policy or Terms & Conditions) is
// stored in site_content, edited from Admin → Website → Legal. Both routes
// (/privacy, /terms) use this same component with a different contentKey.
export default function PolicyPage({ contentKey, title }) {
  const logoUrl = useLogoUrl();
  const [html, setHtml] = useState(null); // null = loading

  useEffect(() => {
    supabase.from("site_content").select("value").eq("key", contentKey).maybeSingle().then(({ data }) => {
      setHtml(data?.value || "");
    });
  }, [contentKey]);

  return (
    <div style={{ minHeight: "100vh", background: T.ivory, fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px 60px" }}>
        <a href="/" style={{ display: "inline-block", marginBottom: 20 }}>
          <img src={logoUrl} alt="" style={{ width: 52, height: 52, borderRadius: "50%", display: "block" }} />
        </a>
        <h1 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 28, color: T.maroonDark, fontWeight: 600, marginBottom: 20 }}>{title}</h1>
        <div className="rounded-2xl shadow-[0_2px_10px_-4px_rgba(36,27,21,0.1)]" style={{ background: "#fff", border: `1px solid ${T.line}`, padding: 22 }}>
          {html === null ? (
            <p style={{ color: T.inkSoft, fontSize: 13 }}>Loading…</p>
          ) : html ? (
            <div className="rich-text-content" style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <p style={{ color: T.inkSoft, fontSize: 13 }}>This page hasn't been published yet.</p>
          )}
        </div>
        <a href="/" style={{ display: "inline-block", marginTop: 24, fontSize: 13, color: T.gold, fontWeight: 600 }}>← Back to home</a>
      </div>
    </div>
  );
}
