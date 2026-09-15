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
      <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save template"}</Btn>
    </div>
  );
}

function EnrolmentFeesEditor() {
  const [primary, setPrimary] = useState("");
  const [sibling, setSibling] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from("settings").select("enrolment_fee_primary, enrolment_fee_sibling").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) { setPrimary(String(data.enrolment_fee_primary)); setSibling(String(data.enrolment_fee_sibling)); }
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await supabase.from("settings").update({ enrolment_fee_primary: Number(primary), enrolment_fee_sibling: Number(sibling) }).eq("id", 1);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>;

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18, marginTop: 20 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>Enrolment fees</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        The one-off enrolment fee shown on the enrolment form and included in the total each student pays.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Primary student ($)"><input style={inputStyle} type="number" step="0.01" min={0} value={primary} onChange={(e) => setPrimary(e.target.value)} /></Field>
        <Field label="Each sibling ($)"><input style={inputStyle} type="number" step="0.01" min={0} value={sibling} onChange={(e) => setSibling(e.target.value)} /></Field>
      </div>
      {saved && <p style={{ color: T.sage, fontSize: 13, marginBottom: 10, fontWeight: 600 }}>Saved.</p>}
      <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save fees"}</Btn>
    </div>
  );
}

export default function SettingsView() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const changePassword = async () => {
    setError("");
    setSuccess(false);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Fill in all three fields.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    setSaving(true);
    try {
      // Verify the current password is actually correct by re-authenticating with it,
      // rather than trusting whatever was typed — Supabase has no separate "check
      // password" call, so signing in again is the standard way to confirm it.
      const { data: userData } = await supabase.auth.getUser();
      const email = userData?.user?.email;
      if (!email) throw new Error("Couldn't determine your account email — try signing in again.");

      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (signInErr) throw new Error("Current password is incorrect.");

      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw updateErr;

      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 460 }}>
      <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18 }}>
        <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 14 }}>Change password</h3>
        <Field label="Current password"><input style={inputStyle} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" /></Field>
        <Field label="New password"><input style={inputStyle} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" /></Field>
        <Field label="Confirm new password"><input style={inputStyle} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" /></Field>
        {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 10 }}>{error}</p>}
        {success && <p style={{ color: T.sage, fontSize: 13, marginBottom: 10, fontWeight: 600 }}>Password updated.</p>}
        <Btn onClick={changePassword} disabled={saving}>{saving ? "Updating…" : "Update password"}</Btn>
      </div>
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
        placeholders={["student_name", "package_size", "classes_used", "renew_link"]}
      />
      <EnrolmentFeesEditor />
    </div>
  );
}
