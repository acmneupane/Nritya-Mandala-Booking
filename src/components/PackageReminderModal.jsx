import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { classesLabel } from "../lib/format";
import { Btn, Modal } from "./ui";

function fillTemplate(template, vars) {
  return template.replace(/{{\s*(\w+)\s*}}/g, (_, key) => vars[key] ?? "");
}

// Preview-then-confirm for the "package used up, payment required" reminder —
// same pattern as the booking confirmation email: nothing sends until the admin
// explicitly confirms. guardianEmails is every distinct guardian email on file for
// this student — all checked by default, any can be unchecked to skip a recipient.
export default function PackageReminderModal({ student, guardianEmails, packageSize, classesUsed, onCancel, onSent }) {
  const [template, setTemplate] = useState(null);
  const [bccEmail, setBccEmail] = useState(null);
  const [bccChecked, setBccChecked] = useState(false);
  const [checkedEmails, setCheckedEmails] = useState(() => new Set(guardianEmails || []));
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("email_templates").select("subject, body").eq("key", "package_expired").maybeSingle()
      .then(({ data }) => setTemplate(data));
    supabase.functions.invoke("send-package-reminder-email", { method: "GET" })
      .then(({ data }) => setBccEmail(data?.bccEmail || null))
      .catch(() => setBccEmail(null));
  }, []);

  const selectedEmails = (guardianEmails || []).filter((e) => checkedEmails.has(e));
  const toggleEmail = (email) => setCheckedEmails((s) => { const next = new Set(s); next.has(email) ? next.delete(email) : next.add(email); return next; });

  const send = async () => {
    setSending(true);
    setError("");
    const { error: fnErr } = await supabase.functions.invoke("send-package-reminder-email", {
      body: { guardianEmails: selectedEmails, studentId: student.id, studentName: student.name, studentCode: student.code, packageSize, classesUsed, includeBcc: bccChecked },
    });
    setSending(false);
    if (fnErr) { setError("Something went wrong sending — you can try again, or check with the parent directly."); return; }
    setSent(true);
    setTimeout(() => onSent(), 1200);
  };

  if (!guardianEmails || guardianEmails.length === 0) {
    return (
      <Modal title="No email sent" onClose={onCancel}>
        <p style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }}>This student has no guardian email on file, so there's nothing to send to. Add one from Edit, then try again.</p>
        <div className="flex justify-end mt-4"><Btn onClick={onCancel}>Close</Btn></div>
      </Modal>
    );
  }

  const vars = { student_name: student.name, package_size: String(packageSize), classes_used: String(classesUsed) };
  const remaining = packageSize - classesUsed;
  vars.status_text = packageSize <= 0
    ? "doesn't have an active package yet"
    : remaining <= 0
      ? "has now been fully used"
      : `has only ${remaining} class${remaining === 1 ? "" : "es"} remaining`;
  const renewLink = student.code ? `${window.location.origin}/renew?code=${encodeURIComponent(student.code)}` : "";
  vars.renew_link = renewLink ? `<a href="${renewLink}">${renewLink}</a>` : "";
  const subject = template ? fillTemplate(template.subject, vars) : "";
  const body = template ? fillTemplate(template.body, vars) : "";

  return (
    <Modal title="Confirm before sending" onClose={onCancel}>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10, lineHeight: 1.5 }}>
        {packageSize > 0 ? `${student.name}'s package (${classesLabel(packageSize)}) ${vars.status_text}.` : `${student.name} ${vars.status_text}.`} Review before sending a payment reminder.
      </p>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 4 }}>Notify:</div>
        {guardianEmails.map((email) => (
          <label key={email} className="flex items-center gap-2" style={{ fontSize: 12.5, color: T.ink, marginBottom: 2 }}>
            <input type="checkbox" checked={checkedEmails.has(email)} onChange={() => toggleEmail(email)} />
            {email}
          </label>
        ))}
      </div>

      {bccEmail && (
        <label className="flex items-center gap-2 mb-3" style={{ fontSize: 12.5, color: T.ink }}>
          <input type="checkbox" checked={bccChecked} onChange={(e) => setBccChecked(e.target.checked)} />
          Bcc {bccEmail} on this email
        </label>
      )}

      {!template ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>Loading template…</p>
      ) : (
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 6 }}>
            <div><strong>To:</strong> {selectedEmails.join(", ") || "(nobody selected)"}</div>
            {bccChecked && bccEmail && <div><strong>Bcc:</strong> {bccEmail}</div>}
            <div><strong>Subject:</strong> {subject}</div>
          </div>
          <div
            style={{ fontSize: 13, color: T.ink, lineHeight: 1.6, background: T.paper, borderRadius: 6, padding: 10 }}
            dangerouslySetInnerHTML={{ __html: body.replace(/\n/g, "<br/>") }}
          />
        </div>
      )}

      {error && <p style={{ color: T.terracotta, fontSize: 13, marginTop: 10 }}>{error}</p>}
      {sent && <p style={{ color: T.sage, fontSize: 13, marginTop: 10, fontWeight: 600 }}>Sent.</p>}
      <div className="flex justify-end gap-2 mt-4">
        <Btn variant="ghost" onClick={onCancel} disabled={sending}>Cancel — don't send</Btn>
        <Btn variant="success" onClick={send} disabled={sending || sent || !template || selectedEmails.length === 0}>{sending ? "Sending…" : "Send email"}</Btn>
      </div>
    </Modal>
  );
}
