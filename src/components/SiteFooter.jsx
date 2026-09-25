import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { useLogoUrl } from "../lib/logo";

const DEFAULT_INFO = {
  studio_address: "72 Central Avenue, Oran Park, NSW 2570",
  social_facebook_url: "https://www.facebook.com/profile.php?id=100095383322004",
  social_tiktok_url: "https://www.tiktok.com/@nritya.mandala",
};

// The public site footer: address with directions, social links, Privacy
// Policy and Terms & Conditions. Address and social links come from Admin
// Config → Studio info. Pass `info` when the page already loaded it (the
// homepage does); otherwise it loads it itself (e.g. the /forms page).
export default function SiteFooter({ info }) {
  const logoUrl = useLogoUrl();
  const [loaded, setLoaded] = useState(null);

  useEffect(() => {
    if (info) return;
    supabase.from("admin_settings").select("studio_address, social_facebook_url, social_tiktok_url").eq("id", 1).maybeSingle()
      .then(({ data }) => { if (data) setLoaded(data); });
  }, [info]);

  const studioInfo = { ...DEFAULT_INFO, ...(info || loaded || {}) };

  return (
    <footer className="px-5 py-16 text-center" style={{ background: T.ink }}>
      <div className="max-w-[600px] mx-auto flex flex-col items-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 overflow-hidden" style={{ background: "#fff" }}>
          <img src={logoUrl} alt="" className="w-full h-full object-cover" />
        </div>
        <h2 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: T.goldLight, fontWeight: 600, marginBottom: 20 }}>Find us</h2>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", marginBottom: 10 }}>📍 {studioInfo.studio_address}</p>
        <a href={`https://maps.google.com/?q=${encodeURIComponent(studioInfo.studio_address)}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: T.goldLight, fontWeight: 600, textDecoration: "underline", letterSpacing: 0.5 }}>GET DIRECTIONS</a>
        <div className="w-full max-w-[320px] flex items-center justify-center gap-2 flex-wrap" style={{ marginTop: 32, paddingTop: 28, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          <a href={studioInfo.social_facebook_url} target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition-opacity" style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>Facebook</a>
          <span style={{ color: "rgba(255,255,255,0.3)" }}>|</span>
          <a href={studioInfo.social_tiktok_url} target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition-opacity" style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>TikTok</a>
        </div>
        <div className="flex items-center justify-center gap-2" style={{ marginTop: 16 }}>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition-opacity" style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Privacy Policy</a>
          <span style={{ color: "rgba(255,255,255,0.25)" }}>|</span>
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition-opacity" style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Terms &amp; Conditions</a>
        </div>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 20 }}>© {new Date().getFullYear()} Nritya Mandala. All rights reserved.</p>
      </div>
    </footer>
  );
}
