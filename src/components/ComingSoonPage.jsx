import { T } from "../lib/theme";
import { LOGO_DATA_URI } from "../lib/logo";

// Shown at app.nrityamandala.com's root now that admin has moved to its own
// subdomain. A placeholder for the future public homepage — but still useful to
// existing families who land here by habit, so it links straight to the pages
// that already work today rather than being a dead end.
export default function ComingSoonPage() {
  return (
    <div style={{ minHeight: "100vh", background: T.maroon, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", padding: 16 }}>
      <div style={{ background: T.ivory, borderRadius: 14, padding: "44px 32px", width: "100%", maxWidth: 420, textAlign: "center", boxSizing: "border-box" }}>
        <img src={LOGO_DATA_URI} alt="" style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 18px", display: "block" }} />
        <p style={{ fontSize: 12, color: T.gold, fontWeight: 700, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>Nritya Mandala</p>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: T.maroonDark, marginBottom: 10 }}>Something exciting is on its way ✨</h1>
        <p style={{ fontSize: 14, color: T.ink, lineHeight: 1.6, marginBottom: 28 }}>
          We're building a proper home for Nritya Mandala online. In the meantime, here's where you actually need to go:
        </p>
        <div className="grid gap-2" style={{ textAlign: "left" }}>
          <a href="/enroll" style={{ display: "block", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: "12px 16px", fontSize: 14, fontWeight: 600, color: T.maroonDark, textDecoration: "none" }}>
            🪷 Enrol a new student
          </a>
          <a href="/parent" style={{ display: "block", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: "12px 16px", fontSize: 14, fontWeight: 600, color: T.maroonDark, textDecoration: "none" }}>
            📋 Look up your booking / QR code
          </a>
        </div>
        <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 28 }}>Studio staff — head to admin.nrityamandala.com</p>
      </div>
    </div>
  );
}
