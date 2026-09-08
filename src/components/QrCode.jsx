import { useEffect, useRef, useState } from "react";
import { T } from "../lib/theme";
import { Btn, Modal } from "./ui";
import { drawQrWithLogo, buildQrCardDataUrl } from "../lib/qrCard";

function QrCanvas({ text, size = 220 }) {
  const canvasRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    // Render at a higher pixel density than the CSS display size so the browser
    // downsamples (crisp) instead of upsampling a low-res buffer (blurry).
    drawQrWithLogo(canvasRef.current, text, { size: size * 3, withLogo: true }).catch(() => setFailed(true));
  }, [text, size]);

  if (failed) return <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: T.terracotta, textAlign: "center", padding: 12 }}>Couldn't generate a QR code.</div>;
  return <canvas ref={canvasRef} style={{ width: size, height: size, display: "block" }} />;
}

export default function QrModal({ student, onClose }) {
  // The QR encodes a URL with the code baked in: a parent scanning it with their own
  // camera app lands straight on their child's page with no typing; the studio's own
  // in-app scanner (Day view) decodes the same URL and pulls the code back out of it.
  const base = `${window.location.origin}/parent?code=${encodeURIComponent(student.code)}`;
  const shareLink = `${window.location.origin}/qr?code=${encodeURIComponent(student.code)}`;
  const [cardDataUrl, setCardDataUrl] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    buildQrCardDataUrl({ studentName: student.name, code: student.code, qrText: base }).then(setCardDataUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (older browsers, permissions) — the link is still visible below to copy manually.
    }
  };

  return (
    <Modal title={`${student.name}'s QR code`} onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <div style={{ border: `2px solid ${T.gold}`, borderRadius: 10, padding: 12, background: "#fff" }}>
          <QrCanvas text={base} size={220} />
        </div>
        <div style={{ marginTop: 14, background: `${T.gold}18`, border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "10px 20px" }}>
          <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 2 }}>Code</div>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 26, letterSpacing: 4, fontWeight: 700, color: T.maroonDark }}>{student.code}</div>
        </div>
        <p style={{ fontSize: 12, color: T.inkSoft, marginTop: 12, lineHeight: 1.5 }}>
          Scanning opens the studio page — {student.name}'s parent then enters this code to see bookings, level, history, and check in for today's class. No login needed.
        </p>

        <div style={{ width: "100%", marginTop: 14, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 4, textAlign: "left" }}>Shareable link — send this to the family directly</div>
          <div className="flex gap-2">
            <input readOnly value={shareLink} style={{ flex: 1, fontSize: 12, padding: "6px 8px", borderRadius: 6, border: `1px solid ${T.line}`, color: T.ink, background: T.paper }} onFocus={(e) => e.target.select()} />
            <Btn size="sm" variant="ghost" onClick={copyLink}>{copied ? "Copied!" : "Copy"}</Btn>
          </div>
          <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 6, textAlign: "left" }}>Opening this link lets the parent view and download the QR code themselves.</p>
        </div>

        <div className="flex gap-2 mt-4">
          {cardDataUrl && (
            <a href={cardDataUrl} download={`${student.name.replace(/\s+/g, "-")}-qr-card.png`}>
              <Btn variant="ghost">Download card</Btn>
            </a>
          )}
          <Btn onClick={onClose}>Done</Btn>
        </div>
      </div>
    </Modal>
  );
}
