import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";

// Banners linking to open forms (Admin → Forms → Build → "Show a banner"),
// on the public homepage (place = "public") or the parent page/app
// (place = "parent"). The link is relative so it stays inside the mobile app,
// and carries &src= so responses show where they came from.
export default function FormBanners({ place, style }) {
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    supabase.rpc("get_form_banners", { p_place: place }).then(({ data }) => setBanners(data || []));
  }, [place]);

  if (banners.length === 0) return null;
  const src = place === "public" ? "homepage" : "parent-page";

  return (
    <div className="grid gap-3" style={style}>
      {banners.map((b) => (
        <a
          key={b.code}
          href={`/forms?code=${encodeURIComponent(b.code)}&src=${src}`}
          className="rounded-2xl flex items-center justify-between gap-3 flex-wrap hover:shadow-md transition-shadow"
          style={{ background: "#fff", border: `1px solid ${T.gold}88`, borderLeft: `5px solid ${T.gold}`, padding: "14px 18px", textDecoration: "none" }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 3 }}>📝 We'd love your input</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.maroonDark, lineHeight: 1.4 }}>{b.banner_text || b.title}</div>
          </div>
          <span style={{ background: T.maroon, color: "#fff", fontSize: 13, fontWeight: 700, borderRadius: 999, padding: "8px 16px", whiteSpace: "nowrap" }}>Fill in the form →</span>
        </a>
      ))}
    </div>
  );
}
