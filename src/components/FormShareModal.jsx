import { useState } from "react";
import { T, inputStyle } from "../lib/theme";
import { Btn, Modal, Select } from "./ui";
import { QrCanvas } from "./QrCode";
import { drawQrWithLogo } from "../lib/qrCard";
import { SHARE_CHANNELS, formLink, sourceKey, effectiveStatus } from "../lib/forms";

// "Share" on a form: pick where the link is going (Facebook, WhatsApp, a
// flyer…) and get that channel's own link and QR code. The channel is added to
// the link as &src=… and saved with every response that comes through it, so
// the CSV export shows where each response came from.
export default function FormShareModal({ form, onClose }) {
  const [channel, setChannel] = useState("");
  const [otherText, setOtherText] = useState("");
  const [copied, setCopied] = useState(false);

  const source = channel === "other" ? sourceKey(otherText) : channel;
  const ready = channel !== "" && (channel !== "other" || !!source);
  const link = ready ? formLink(form.code, source === "direct" ? null : source) : "";
  const status = effectiveStatus(form);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the link is visible to copy by hand.
    }
  };

  const downloadQr = async () => {
    const canvas = document.createElement("canvas");
    await drawQrWithLogo(canvas, link, { size: 1024, withLogo: true });
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${form.code}${source && source !== "direct" ? `-${source}` : ""}-qr.png`;
    a.click();
  };

  return (
    <Modal title={`Share “${form.title}”`} onClose={onClose}>
      {status === "draft" && (
        <p style={{ fontSize: 12.5, color: T.terracotta, background: `${T.terracotta}12`, border: `1px solid ${T.terracotta}44`, borderRadius: 8, padding: "8px 12px", marginBottom: 12, lineHeight: 1.5 }}>
          This form is still a <strong>Draft</strong> — the link goes to the homepage until you open it.
        </p>
      )}
      {status === "closed" && (
        <p style={{ fontSize: 12.5, color: T.inkSoft, background: T.paper, borderRadius: 8, padding: "8px 12px", marginBottom: 12, lineHeight: 1.5 }}>
          This form is <strong>Closed</strong> — the link shows “no longer accepting responses”.
        </p>
      )}

      <span className="block text-xs font-medium mb-1" style={{ color: T.inkSoft }}>Where will you share it?</span>
      <Select value={channel} onChange={(e) => { setChannel(e.target.value); setCopied(false); }}>
        <option value="">Choose…</option>
        {SHARE_CHANNELS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        <option value="other">Somewhere else…</option>
        <option value="direct">Plain link (no source)</option>
      </Select>
      {channel === "other" && (
        <input
          style={{ ...inputStyle, marginTop: 8 }}
          value={otherText}
          onChange={(e) => { setOtherText(e.target.value); setCopied(false); }}
          placeholder="e.g. Community newsletter"
          autoFocus
        />
      )}

      {ready && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 4 }}>Link</div>
          <div className="flex gap-2 items-center">
            <input readOnly value={link} style={{ ...inputStyle, fontSize: 12.5 }} onFocus={(e) => e.target.select()} />
            <Btn size="sm" onClick={copy}>{copied ? "Copied ✓" : "Copy"}</Btn>
          </div>
          <div className="flex items-center gap-3" style={{ marginTop: 14 }}>
            <div style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 6, background: "#fff" }}>
              <QrCanvas text={link} size={120} />
            </div>
            <div>
              <p style={{ fontSize: 12, color: T.inkSoft, lineHeight: 1.5, marginBottom: 8 }}>QR code for this link — for flyers, posters or screens.</p>
              <Btn size="sm" variant="ghost" onClick={downloadQr}>⬇ Download QR</Btn>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end mt-4">
        <Btn variant="ghost" onClick={onClose}>Done</Btn>
      </div>
    </Modal>
  );
}
