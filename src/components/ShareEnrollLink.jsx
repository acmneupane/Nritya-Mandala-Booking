import { useState } from "react";
import { T } from "../lib/theme";

export default function ShareEnrollLink({ compact }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/enroll`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (older browsers, permissions) — nothing to fall back to here silently, just no-op.
    }
  };

  if (compact) {
    return (
      <button
        onClick={copy}
        title={link}
        style={{ fontSize: 12, color: copied ? T.sage : T.gold, fontWeight: 600, background: "transparent", border: "none", padding: "4px 6px", whiteSpace: "nowrap" }}
      >
        {copied ? "Copied!" : "🔗 Copy enrolment link"}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: `${T.gold}18`, border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "8px 12px" }}>
      <span style={{ fontSize: 12, color: T.inkSoft }}>Enrolment form:</span>
      <code style={{ fontSize: 12, color: T.ink, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link}</code>
      <button onClick={copy} style={{ fontSize: 12, color: copied ? T.sage : T.maroon, fontWeight: 600, background: "transparent", border: "none", whiteSpace: "nowrap" }}>
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
