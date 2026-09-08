import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { LOGO_DATA_URI } from "../lib/logo";

export default function FamilyView({ children, onPick, onBack }) {
  const [levelById, setLevelById] = useState({});

  useEffect(() => {
    const levelIds = [...new Set(children.map((c) => c.level_id).filter(Boolean))];
    if (levelIds.length === 0) return;
    supabase.from("levels").select("id, name").in("id", levelIds).then(({ data }) => {
      setLevelById(Object.fromEntries((data || []).map((l) => [l.id, l.name])));
    });
  }, [children]);

  return (
    <div style={{ minHeight: "100vh", background: T.ivory, fontFamily: "Inter, sans-serif", padding: "32px 16px" }}>
      <div style={{ maxWidth: 420, margin: "0 auto" }}>
        <img src={LOGO_DATA_URI} alt="" style={{ width: 40, height: 40, borderRadius: "50%", marginBottom: 8 }} />
        <p style={{ fontSize: 12, color: T.gold, fontWeight: 600, marginBottom: 4 }}>Nritya Mandala</p>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: T.maroonDark, marginBottom: 4 }}>Your children</h1>
        <p style={{ fontSize: 13, color: T.inkSoft, marginBottom: 20 }}>Choose a child to see their bookings, level, and history.</p>

        <div className="grid gap-2">
          {children.map((c) => (
            <button
              key={c.id}
              onClick={() => onPick(c)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${T.gold}`, borderRadius: 8, padding: "14px 16px", textAlign: "left" }}
            >
              <span style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark }}>{c.name}</span>
              {levelById[c.level_id] && (
                <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, background: `${T.sage}22`, color: T.sage, fontWeight: 600 }}>{levelById[c.level_id]}</span>
              )}
            </button>
          ))}
        </div>

        <button onClick={onBack} style={{ fontSize: 12, color: T.inkSoft, marginTop: 20, textDecoration: "underline" }}>← Look up a different code</button>
      </div>
    </div>
  );
}
