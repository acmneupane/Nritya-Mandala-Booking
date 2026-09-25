import { T } from "../lib/theme";
import { INVALID_BORDER, INVALID_BG } from "../lib/validation";

// Pieces for the shared public-form validation style (see lib/validation.js).

// Short red note under a field that needs fixing.
export function FieldNote({ text }) {
  return <div style={{ fontSize: 12.5, fontWeight: 600, color: T.terracotta, marginTop: 6 }}>{text}</div>;
}

// Wraps one field (or group, e.g. a package list). With a problem it gets a
// red border, a faint red tint and the note; without one it looks unchanged
// (a transparent border keeps the layout from jumping).
export function FieldWrap({ id, problem, children, style }) {
  return (
    <div
      id={`field-${id}`}
      style={{
        padding: 8, margin: "0 -8px", borderRadius: 10,
        border: problem ? INVALID_BORDER : "2px solid transparent",
        background: problem ? INVALID_BG : "transparent",
        ...style,
      }}
    >
      {children}
      {problem && <FieldNote text={problem} />}
    </div>
  );
}

// The single message above Submit: centred, larger, red-bordered.
export function FormErrorBox({ message }) {
  if (!message) return null;
  return (
    <div role="alert" style={{ marginTop: 16, marginBottom: 4, border: INVALID_BORDER, background: `${T.terracotta}10`, borderRadius: 10, padding: "12px 14px", textAlign: "center", fontSize: 15.5, fontWeight: 600, color: T.terracotta, lineHeight: 1.45 }}>
      {message}
    </div>
  );
}

// Big Yes / No buttons (e.g. "Have you made the payment?").
export function YesNoChoice({ value, onChange }) {
  const pill = (key, label) => {
    const active = value === key;
    return (
      <button
        type="button"
        onClick={() => onChange(key)}
        aria-pressed={active}
        style={{
          minWidth: 76, padding: "10px 20px", borderRadius: 999, fontSize: 14.5, fontWeight: 700,
          border: `2px solid ${active ? T.maroon : T.line}`,
          background: active ? T.maroon : "#fff", color: active ? "#fff" : T.ink,
        }}
      >
        {label}
      </button>
    );
  };
  return <div className="flex gap-2">{pill("yes", "Yes")}{pill("no", "No")}</div>;
}
