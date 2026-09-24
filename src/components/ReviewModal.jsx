import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";

// Shared by ParentView and FamilyView — a review link "for the family," not
// tied to any one student, so it's the same popup content either place.
export default function ReviewModal({ onClose }) {
  const [links, setLinks] = useState({
    facebook: "https://www.facebook.com/profile.php?id=100095383322004",
    tiktok: "https://www.tiktok.com/@nritya.mandala",
    googleReview: "https://g.page/r/Cd0RBuUBpA3jEBM/review",
  });

  useEffect(() => {
    supabase.from("admin_settings").select("social_facebook_url, social_tiktok_url, social_google_review_url").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setLinks({ facebook: data.social_facebook_url, tiktok: data.social_tiktok_url, googleReview: data.social_google_review_url });
    });
  }, []);

  return (
    <div
      onClick={onClose}
      className="backdrop-blur-sm"
      style={{ position: "fixed", inset: 0, background: "rgba(43,33,28,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
    >
      <div onClick={(e) => e.stopPropagation()} className="rounded-2xl shadow-xl" style={{ background: "#fff", padding: "20px 20px 8px", maxWidth: 360, width: "100%" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 19, color: T.maroonDark }}>Leave us a review</h3>
          <button onClick={onClose} style={{ fontSize: 18, color: T.inkSoft, lineHeight: 1, padding: 2 }}>✕</button>
        </div>
        <a href={links.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:bg-[#F1DFCB]" style={{ padding: "13px 6px", borderTop: `1px solid ${T.line}`, borderRadius: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: 999, background: "#1877F2", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 17, flexShrink: 0 }}>f</div>
          <div style={{ flexGrow: 1, fontSize: 14, fontWeight: 600, color: T.ink }}>Review us on Facebook</div>
          <span style={{ color: T.inkSoft, fontSize: 13 }}>↗</span>
        </a>
        <a href={links.tiktok} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:bg-[#F1DFCB]" style={{ padding: "13px 6px", borderTop: `1px solid ${T.line}`, borderRadius: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: 999, background: "#010101", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
            <span style={{ position: "absolute", fontSize: 15, color: "#25F4EE", transform: "translate(-1.5px,-1px)" }}>♪</span>
            <span style={{ position: "absolute", fontSize: 15, color: "#FE2C55", transform: "translate(1.5px,1px)" }}>♪</span>
            <span style={{ position: "absolute", fontSize: 15, color: "#fff" }}>♪</span>
          </div>
          <div style={{ flexGrow: 1, fontSize: 14, fontWeight: 600, color: T.ink }}>Follow us on TikTok</div>
          <span style={{ color: T.inkSoft, fontSize: 13 }}>↗</span>
        </a>
        <a href={links.googleReview} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:bg-[#F1DFCB]" style={{ padding: "13px 6px", borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}`, borderRadius: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: 999, background: "#fff", border: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontFamily: "Arial, sans-serif", fontWeight: 700, fontSize: 18, background: "conic-gradient(from -45deg, #4285F4 0deg 90deg, #34A853 90deg 180deg, #FBBC05 180deg 270deg, #EA4335 270deg 360deg)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>G</span>
          </div>
          <div style={{ flexGrow: 1, fontSize: 14, fontWeight: 600, color: T.ink }}>Review us on Google</div>
          <span style={{ color: T.inkSoft, fontSize: 13 }}>↗</span>
        </a>
      </div>
    </div>
  );
}
