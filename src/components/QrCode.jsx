import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeLib } from "../lib/qrcode";
import { T } from "../lib/theme";
import { Btn, Modal } from "./ui";

// Renders a QR code to a <canvas> entirely offline using the vendored QRCodeLib —
// no network request, works even without internet.
function QrCanvas({ text, size = 220, onReady }) {
  const canvasRef = useRef(null);
  const matrix = useMemo(() => {
    try {
      const qr = QRCodeLib(0, "M");
      qr.addData(text);
      qr.make();
      const n = qr.getModuleCount();
      const rows = [];
      for (let r = 0; r < n; r++) {
        const row = [];
        for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
        rows.push(row);
      }
      return rows;
    } catch (e) {
      console.error("QR generation failed", e);
      return null;
    }
  }, [text]);

  useEffect(() => {
    if (!matrix || !canvasRef.current) return;
    const n = matrix.length;
    const quiet = 2;
    const total = n + quiet * 2;
    const cell = Math.max(1, Math.floor(size / total));
    const px = cell * total;
    const canvas = canvasRef.current;
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = T.maroonDark;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (matrix[r][c]) ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
      }
    }
    if (onReady) onReady(canvas.toDataURL("image/png"));
  }, [matrix, size]);

  if (!matrix) return <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: T.terracotta, textAlign: "center", padding: 12 }}>Couldn't generate a QR code.</div>;
  return <canvas ref={canvasRef} style={{ width: size, height: size, display: "block" }} />;
}

export default function QrModal({ student, onClose }) {
  // The QR takes them to the parent lookup page; the code below is what actually gets
  // them to this student's page. We use the real deployed origin, not a hash link.
  const base = `${window.location.origin}/parent`;
  const [pngDataUrl, setPngDataUrl] = useState(null);

  return (
    <Modal title={`${student.name}'s QR code`} onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <div style={{ border: `2px solid ${T.gold}`, borderRadius: 10, padding: 12, background: "#fff" }}>
          <QrCanvas text={base} size={220} onReady={setPngDataUrl} />
        </div>
        <div style={{ marginTop: 14, background: `${T.gold}18`, border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "10px 20px" }}>
          <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 2 }}>Code</div>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 26, letterSpacing: 4, fontWeight: 700, color: T.maroonDark }}>{student.code}</div>
        </div>
        <p style={{ fontSize: 12, color: T.inkSoft, marginTop: 12, lineHeight: 1.5 }}>
          Scanning opens the studio page — {student.name}'s parent then enters this code to see bookings, level, history, and check in for today's class. No login needed. Print both onto their card.
        </p>
        <div className="flex gap-2 mt-4">
          {pngDataUrl && (
            <a href={pngDataUrl} download={`${student.name.replace(/\s+/g, "-")}-qr.png`}>
              <Btn variant="ghost">Download PNG</Btn>
            </a>
          )}
          <Btn onClick={onClose}>Done</Btn>
        </div>
      </div>
    </Modal>
  );
}
