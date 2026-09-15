import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Field } from "./ui";

function EmailTemplateEditor({ templateKey, title, description, placeholders }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from("email_templates").select("subject, body").eq("key", templateKey).maybeSingle().then(({ data }) => {
      if (data) { setSubject(data.subject); setBody(data.body); }
      setLoading(false);
    });
  }, [templateKey]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await supabase.from("email_templates").update({ subject, body, updated_at: new Date().toISOString() }).eq("key", templateKey);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>;

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18, marginTop: 20 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>{title}</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        {description} Available placeholders:{" "}
        {placeholders.map((p) => (
          <code key={p} style={{ background: T.paper, padding: "1px 5px", borderRadius: 4, marginRight: 4 }}>{`{{${p}}}`}</code>
        ))}
      </p>
      <Field label="Subject"><input style={inputStyle} value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
      <Field label="Body"><textarea style={{ ...inputStyle, minHeight: 220, fontFamily: "monospace", fontSize: 13 }} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
      {saved && <p style={{ color: T.sage, fontSize: 13, marginBottom: 10, fontWeight: 600 }}>Saved.</p>}
      <Btn variant="success" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save template"}</Btn>
    </div>
  );
}

function EnrolmentFeesEditor() {
  const [enabled, setEnabled] = useState(false);
  const [label, setLabel] = useState("");
  const [primary, setPrimary] = useState("");
  const [sibling, setSibling] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from("settings").select("enrolment_fee_enabled, enrolment_fee_label, enrolment_fee_primary, enrolment_fee_sibling").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) {
        setEnabled(data.enrolment_fee_enabled);
        setLabel(data.enrolment_fee_label);
        setPrimary(String(data.enrolment_fee_primary));
        setSibling(String(data.enrolment_fee_sibling));
      }
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await supabase.from("settings").update({
      enrolment_fee_enabled: enabled, enrolment_fee_label: label.trim() || "One-off Enrolment fee",
      enrolment_fee_primary: Number(primary), enrolment_fee_sibling: Number(sibling),
    }).eq("id", 1);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>;

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18, marginTop: 20 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>Enrolment fee</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        A one-off fee shown and charged on the enrolment form — applies even before a class is available, if enabled.
      </p>
      <label className="flex items-center gap-2 mb-3" style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Charge this fee on new enrolments
      </label>
      <Field label="Label shown to parents"><input style={inputStyle} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="One-off Enrolment fee" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Primary student ($)"><input style={inputStyle} type="number" step="0.01" min={0} value={primary} onChange={(e) => setPrimary(e.target.value)} /></Field>
        <Field label="Each sibling ($)"><input style={inputStyle} type="number" step="0.01" min={0} value={sibling} onChange={(e) => setSibling(e.target.value)} /></Field>
      </div>
      {saved && <p style={{ color: T.sage, fontSize: 13, marginBottom: 10, fontWeight: 600 }}>Saved.</p>}
      <Btn variant="success" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save fees"}</Btn>
    </div>
  );
}

export default function StudioSettingsView() {
  const [section, setSection] = useState("fee");

  return (
    <div style={{ maxWidth: 460 }}>
      <div className="flex gap-1 mb-4" style={{ background: T.paper, borderRadius: 8, padding: 3, display: "inline-flex" }}>
        <button
          onClick={() => setSection("fee")}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, background: section === "fee" ? "#fff" : "transparent", color: section === "fee" ? T.maroonDark : T.inkSoft, fontWeight: section === "fee" ? 600 : 400 }}
        >
          Enrolment fee
        </button>
        <button
          onClick={() => setSection("emails")}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, background: section === "emails" ? "#fff" : "transparent", color: section === "emails" ? T.maroonDark : T.inkSoft, fontWeight: section === "emails" ? 600 : 400 }}
        >
          Email templates
        </button>
      </div>

      {section === "fee" ? (
        <EnrolmentFeesEditor />
      ) : (
        <>
          <EmailTemplateEditor
            templateKey="enrollment_approved"
            title="Enrolment approval email"
            description="Sent automatically to the parent when you approve their request."
            placeholders={["student_name", "day", "time", "start_date", "access_code", "qr_link", "qr_code_image"]}
          />
          <EmailTemplateEditor
            templateKey="package_expired"
            title="Payment required (package expired) email"
            description="Sent when you click 'Payment required' on a student whose package has run out."
            placeholders={["student_name", "package_size", "classes_used", "status_text", "renew_link"]}
          />
        </>
      )}
    </div>
  );
}
