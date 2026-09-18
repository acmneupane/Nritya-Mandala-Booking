import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { classesLabel } from "../lib/format";
import { Btn, Modal } from "./ui";
import { EMAIL_FOOTER_HTML } from "../lib/emailFooter";

function fillTemplate(template, vars) {
  return template.replace(/{{\s*(\w+)\s*}}/g, (_, key) => vars[key] ?? "");
}

// Preview-then-confirm for the renewal-approved confirmation email — shown right
// after an admin approves a renewal request, same pattern as the enrolment booking
// confirmation and the package-reminder email. guardianEmails is every distinct
// guardian email on file for this student — all checked by default.
export default function RenewalApprovalEmailModal({ student, guardianEmails, tierName, classesTotal, amount, onCancel, onSent }) {
  const [template, setTemplate] = useState(null);
  const [bccEmail, setBccEmail] = useState(null);
  const [bccChecked, setBccChecked] = useState(false);
  const [checkedEmails, setCheckedEmails] = useState(() => new Set(guardianEmails || []));
  const [limitInfo, setLimitInfo] = useState(null);
  const [limitLoaded, setLimitLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [bodyText, setBodyText] = useState(null);

  useEffect(() => {
    supabase.from("email_templates").select("subject, body").eq("key", "renewal_approved").maybeSingle()
      .then(({ data }) => setTemplate(data));
    supabase.functions.invoke("send-renewal-approval-email", { method: "GET" })
      .then(({ data }) => {
        setBccEmail(data?.bccEmail || null);
        if (typeof data?.todayCount === "number") setLimitInfo({ todayCount: data.todayCount, dailyLimit: data.dailyLimit, monthCount: data.monthCount, monthLimit: data.monthLimit });
      })
      .catch(() => setBccEmail(null))
      .finally(() => setLimitLoaded(true));
  }, []);

  const selectedEmails = (guardianEmails || []).filter((e) => checkedEmails.has(e));
  const toggleEmail = (email) => setCheckedEmails((s) => { const next = new Set(s); next.has(email) ? next.delete(email) : next.add(email); return next; });

  const plannedRecipientRows = selectedEmails.length + (bccChecked && bccEmail ? 1 : 0);
  const wouldExceedDay = limitInfo && (limitInfo.todayCount + plannedRecipientRows > limitInfo.dailyLimit);
  const wouldExceedMonth = limitInfo && (limitInfo.monthCount + plannedRecipientRows > limitInfo.monthLimit);
  const wouldExceed = wouldExceedDay || wouldExceedMonth;
  const nearLimit = limitInfo && !wouldExceed && (
    (limitInfo.todayCount + plannedRecipientRows >= limitInfo.dailyLimit * 0.8) ||
    (limitInfo.monthCount + plannedRecipientRows >= limitInfo.monthLimit * 0.8)
  );

  const vars = { student_name: student.name, tier_name: tierName || "", classes_total: String(classesTotal ?? ""), amount: Number(amount ?? 0).toFixed(2) };
  const subject = template ? fillTemplate(template.subject, vars) : "";

  useEffect(() => {
    if (template && bodyText === null) setBodyText(fillTemplate(template.body, vars));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template]);

  const send = async () => {
    setSending(true);
    setError("");
    const { error: fnErr } = await supabase.functions.invoke("send-renewal-approval-email", {
      body: { guardianEmails: selectedEmails, studentId: student.id, studentName: student.name, tierName, classesTotal, amount, includeBcc: bccChecked, bodyOverride: bodyText },
    });
    setSending(false);
    if (fnErr) { setError("Something went wrong sending — you can try again, or check with the parent directly."); return; }
    setSent(true);
    setTimeout(() => onSent(), 1200);
  };

  const copyContent = () => {
    if (!template) return;
    navigator.clipboard.writeText(`To: ${selectedEmails.join(", ")}\nSubject: ${subject}\n\n${bodyText}\n\n(Facebook footer is added automatically and isn't included here.)`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!guardianEmails || guardianEmails.length === 0) {
    return (
      <Modal title="No confirmation email sent" onClose={onCancel}>
        <p style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }}>This student has no guardian email on file, so there's nothing to send to. The renewal was still approved normally.</p>
        <div className="flex justify-end mt-4"><Btn onClick={onCancel}>Close</Btn></div>
      </Modal>
    );
  }

  return (
    <Modal title="Confirm before sending" onClose={onCancel}>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10, lineHeight: 1.5 }}>
        {student.name}'s renewal ({classesTotal ? classesLabel(classesTotal) : "package"}{tierName ? `, ${tierName}` : ""}) was approved. Review before sending a confirmation.
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

      {wouldExceed && (
        <div style={{ background: `${T.terracotta}18`, border: `1px solid ${T.terracotta}55`, borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
          <p style={{ fontSize: 12.5, color: T.terracotta, fontWeight: 600, marginBottom: 6 }}>
            {wouldExceedDay
              ? `Today's email limit (${limitInfo.dailyLimit}/day) would be exceeded — ${limitInfo.todayCount} sent already, this would add ${plannedRecipientRows} more.`
              : `This month's email limit (${limitInfo.monthLimit}/month) would be exceeded — ${limitInfo.monthCount} sent already, this would add ${plannedRecipientRows} more.`}
          </p>
          <p style={{ fontSize: 12, color: T.ink, marginBottom: 8 }}>This can't be sent automatically right now. Copy the content below and send it yourself instead.</p>
          <Btn size="sm" variant="ghost" onClick={copyContent} disabled={!template || bodyText === null}>{copied ? "Copied ✓" : "📋 Copy email content"}</Btn>
        </div>
      )}
      {nearLimit && (
        <p style={{ fontSize: 12, color: T.gold, marginBottom: 12 }}>
          ⚠ Getting close to the email limit — {limitInfo.todayCount + plannedRecipientRows} of {limitInfo.dailyLimit} today, {limitInfo.monthCount + plannedRecipientRows} of {limitInfo.monthLimit} this month.
        </p>
      )}

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
          <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 4 }}>
            Edit the body for this send only — this won't change the saved template in Studio Settings.
          </div>
          <textarea
            style={{ ...inputStyle, minHeight: 140, fontFamily: "monospace", fontSize: 12.5, lineHeight: 1.5 }}
            value={bodyText ?? ""}
            onChange={(e) => setBodyText(e.target.value)}
          />
          <div
            style={{ fontSize: 12, color: T.inkSoft, marginTop: 8 }}
            dangerouslySetInnerHTML={{ __html: EMAIL_FOOTER_HTML }}
          />
          <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>The Facebook footer above is added automatically and can't be edited here.</div>
        </div>
      )}

      {error && <p style={{ color: T.terracotta, fontSize: 13, marginTop: 10 }}>{error}</p>}
      {sent && <p style={{ color: T.sage, fontSize: 13, marginTop: 10, fontWeight: 600 }}>Sent.</p>}
      <div className="flex justify-end gap-2 mt-4">
        <Btn variant="ghost" onClick={onCancel} disabled={sending}>Cancel — don't send</Btn>
        <Btn variant="success" onClick={send} disabled={sending || sent || !template || bodyText === null || !limitLoaded || selectedEmails.length === 0 || wouldExceed}>
          {sending ? "Sending…" : !template || !limitLoaded ? "Loading…" : "Send email"}
        </Btn>
      </div>
    </Modal>
  );
}
