import { useState } from "react";
import { T } from "../lib/theme";

export function Btn({ children, onClick, variant = "primary", size = "md", type = "button", disabled }) {
  const base = "inline-flex items-center gap-2 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const sizes = { sm: "px-3 py-1.5 text-sm rounded-md", md: "px-4 py-2 text-sm rounded-md", lg: "px-5 py-2.5 text-base rounded-md" };
  const variants = {
    primary: { backgroundColor: T.maroon, color: T.ivory },
    gold: { backgroundColor: T.gold, color: T.maroonDark },
    ghost: { backgroundColor: "transparent", color: T.maroon, border: `1px solid ${T.line}` },
    danger: { backgroundColor: "transparent", color: T.terracotta, border: `1px solid ${T.terracotta}55` },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]}`} style={variants[variant]}>
      {children}
    </button>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-medium mb-1" style={{ color: T.inkSoft }}>{label}</span>
      {children}
    </label>
  );
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(43,33,28,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: T.ivory, borderRadius: 10, padding: 20, width: "100%", maxWidth: wide ? 560 : 420, maxHeight: "88vh", overflowY: "auto", overflowX: "hidden", border: `1px solid ${T.line}`, boxSizing: "border-box" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 19, color: T.maroonDark }}>{title}</h3>
          <button onClick={onClose} style={{ color: T.inkSoft, fontSize: 18, padding: 4 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({ title = "Are you sure?", message, confirmLabel = "Confirm", onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p style={{ fontSize: 13, color: T.ink, marginBottom: 20, lineHeight: 1.5 }}>{message}</p>
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="danger" onClick={onConfirm}>{confirmLabel}</Btn>
      </div>
    </Modal>
  );
}

// Extra guard for genuinely destructive, hard-to-undo actions: requires typing an
// exact confirmation string (e.g. the student's code) before the button unlocks.
export function TypeToConfirmModal({ title = "Are you sure?", message, confirmString, confirmLabel = "Confirm", onConfirm, onCancel }) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toUpperCase() === confirmString.toUpperCase();
  return (
    <Modal title={title} onClose={onCancel}>
      <p style={{ fontSize: 13, color: T.ink, marginBottom: 14, lineHeight: 1.5 }}>{message}</p>
      <Field label={`Type "${confirmString}" to confirm`}>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontSize: 14, fontFamily: "Inter, sans-serif", letterSpacing: 1 }}
          placeholder={confirmString}
          autoFocus
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="danger" onClick={onConfirm} disabled={!matches}>{confirmLabel}</Btn>
      </div>
    </Modal>
  );
}
