import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Field } from "./ui";

// Shown instead of your email wherever an admin picks "who" from a list — e.g.
// the "Who paid?" field on an expense. Purely self-service (each admin sets
// their own via auth.updateUser); there's no admin-editing-others UI, since
// this is a small team and everyone already has their own login.
function DisplayNameEditor() {
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setDisplayName(data?.user?.user_metadata?.display_name || "");
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setError("");
    setSuccess(false);
    setSaving(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ data: { display_name: displayName.trim() } });
      if (updateErr) throw updateErr;
      setSuccess(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18, marginBottom: 16 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>Display name</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        Shown instead of your email wherever the admin app lists studio logins — e.g. picking who paid an expense. Leave blank to keep showing your email.
      </p>
      <Field label="Display name"><input style={inputStyle} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Sarita" /></Field>
      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 10 }}>{error}</p>}
      {success && <p style={{ color: T.sage, fontSize: 13, marginBottom: 10, fontWeight: 600 }}>Saved.</p>}
      <Btn variant="success" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save display name"}</Btn>
    </div>
  );
}

export default function AccountView() {
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
      <DisplayNameEditor />
      <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18 }}>
        <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 14 }}>Change password</h3>
        <Field label="Current password"><input style={inputStyle} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" /></Field>
        <Field label="New password"><input style={inputStyle} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" /></Field>
        <Field label="Confirm new password"><input style={inputStyle} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" /></Field>
        {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 10 }}>{error}</p>}
        {success && <p style={{ color: T.sage, fontSize: 13, marginBottom: 10, fontWeight: 600 }}>Password updated.</p>}
        <Btn variant="success" onClick={changePassword} disabled={saving}>{saving ? "Updating…" : "Update password"}</Btn>
      </div>
    </div>
  );
}
