import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { T } from "../lib/theme";
import { Btn, Modal } from "./ui";

// Extracts a student code whether the QR held a bare code or a full
// ".../parent?code=XXXX" URL (which is what our own QR codes now encode).
function extractCode(decodedText) {
  try {
    const url = new URL(decodedText);
    const fromQuery = url.searchParams.get("code");
    if (fromQuery) return fromQuery.toUpperCase();
  } catch {
    // Not a URL — fall through and treat the raw text as the code.
  }
  return decodedText.trim().toUpperCase();
}

export default function QrScanner({ title, onDetected, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(document.createElement("canvas"));
  const rafRef = useRef(null);
  const cooldownRef = useRef(false);
  const [cameraError, setCameraError] = useState("");
  const [lastResult, setLastResult] = useState(null); // { code, ok, message }

  useEffect(() => {
    let stream;
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          tick();
        }
      } catch (e) {
        setCameraError("Couldn't access the camera — check browser permissions, or use a device with a camera.");
      }
    };

    const tick = () => {
      const video = videoRef.current;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA && !cooldownRef.current) {
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(imageData.data, imageData.width, imageData.height);
        if (result && result.data) {
          const code = extractCode(result.data);
          cooldownRef.current = true;
          Promise.resolve(onDetected(code)).then((res) => {
            setLastResult({ code, ...res });
            setTimeout(() => { cooldownRef.current = false; }, 1500);
          });
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    start();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  return (
    <Modal title={title || "Scan to check in"} onClose={onClose}>
      {cameraError ? (
        <p style={{ color: T.terracotta, fontSize: 13 }}>{cameraError}</p>
      ) : (
        <>
          <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "#000" }}>
            <video ref={videoRef} playsInline muted style={{ width: "100%", display: "block" }} />
            <div style={{ position: "absolute", inset: "15% 22%", border: `3px solid ${T.gold}`, borderRadius: 12, pointerEvents: "none" }} />
          </div>
          <p style={{ fontSize: 12, color: T.inkSoft, marginTop: 10, textAlign: "center" }}>Point the camera at a student's QR code</p>
          {lastResult && (
            <div style={{ marginTop: 10, textAlign: "center", padding: "8px 12px", borderRadius: 8, background: lastResult.ok ? `${T.sage}18` : `${T.terracotta}18`, color: lastResult.ok ? T.sage : T.terracotta, fontSize: 13, fontWeight: 600 }}>
              {lastResult.message}
            </div>
          )}
        </>
      )}
      <div className="flex justify-end mt-3">
        <Btn variant="ghost" onClick={onClose}>Done</Btn>
      </div>
    </Modal>
  );
}
