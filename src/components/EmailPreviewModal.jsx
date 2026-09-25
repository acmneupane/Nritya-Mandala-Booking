import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Modal } from "./ui";
import { QrCanvas } from "./QrCode";
import { formatTimeRange } from "../lib/scheduling";
import { APP_ORIGIN } from "../lib/origins";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function formatDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${ordinal(d)} of ${MONTHS[m - 1]}`;
}
function fillTemplate(template, vars) {
  return template.replace(/{{\s*(\w+)\s*}}/g, (_, key) => vars[key] ?? "");
}

// Placeholder values for one student. The QR link and image are left as
// placeholders: only the send-approval-email function can build the real QR
// image (and it fills both in, in edited text too), so the editable text keeps
// them as markers for where they go.
function studentVars(s) {
  return {
    student_name: s.name,
    day: s.day,
    time: formatTimeRange(s.time, s.endTime),
    start_date: formatDate(s.startDate),
    access_code: s.code,
    qr_link: "{{qr_link}}",
    qr_code_image: "{{qr_code_image}}",
  };
}

// Preview of the (possibly edited) text: the link shown as a link, the QR image
// shown separately below the preview.
function previewHtml(text, qrLink) {
  return text
    .replace(/{{\s*qr_link\s*}}/g, `<a href="${qrLink}">${qrLink}</a>`)
    .replace(/{{\s*qr_code_image\s*}}/g, "")
    .replace(/\n/g, "<br/>");
}

// Shows exactly what's about to be emailed — subject, recipients, body, and the QR
// attachment — before it actually sends, so nothing goes out by accident (e.g. while
// testing, or for a request where no email was actually given). guardianEmails is
// every distinct guardian email on file for these students — all checked by default
// (everyone gets notified), but any can be unchecked to skip a particular recipient.
export default function EmailPreviewModal({ guardianEmails, students, onCancel, onSent }) {
  const [template, setTemplate] = useState(null);
  const [bccEmail, setBccEmail] = useState(null);
  const [bccChecked, setBccChecked] = useState(false);
  const [checkedEmails, setCheckedEmails] = useState(() => new Set(guardianEmails || []));
  const [limitInfo, setLimitInfo] = useState(null); // { todayCount, dailyLimit, monthCount, monthLimit }
  const [limitLoaded, setLimitLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  // Per-student body text for this send only (keyed by code), and which ones
  // have their editor open. Starts as the filled-in saved template.
  const [bodies, setBodies] = useState({});
  const [editing, setEditing] = useState(() => new Set());

  useEffect(() => {
    supabase.from("email_templates").select("subject, body").eq("key", "enrollment_approved").maybeSingle()
      .then(({ data }) => setTemplate(data));
    supabase.functions.invoke("send-approval-email", { method: "GET" })
      .then(({ data }) => {
        setBccEmail(data?.bccEmail || null);
        if (typeof data?.todayCount === "number") setLimitInfo({ todayCount: data.todayCount, dailyLimit: data.dailyLimit, monthCount: data.monthCount, monthLimit: data.monthLimit });
      })
      .catch(() => setBccEmail(null))
      .finally(() => setLimitLoaded(true));
  }, []);

  const eligible = students.filter((s) => s.day && s.startDate && s.code);
  const defaultBody = (s) => (template ? fillTemplate(template.body, studentVars(s)) : "");
  const bodyFor = (s) => bodies[s.code] ?? defaultBody(s);
  const toggleEditing = (code) => setEditing((cur) => {
    const next = new Set(cur);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    return next;
  });
  const skipped = students.filter((s) => !(s.day && s.startDate && s.code));
  const selectedEmails = (guardianEmails || []).filter((e) => checkedEmails.has(e));
  const toggleEmail = (email) => setCheckedEmails((s) => { const next = new Set(s); next.has(email) ? next.delete(email) : next.add(email); return next; });

  const plannedRecipientRows = eligible.length * (selectedEmails.length + (bccChecked && bccEmail ? 1 : 0));
  const wouldExceedDay = limitInfo && (limitInfo.todayCount + plannedRecipientRows > limitInfo.dailyLimit);
  const wouldExceedMonth = limitInfo && (limitInfo.monthCount + plannedRecipientRows > limitInfo.monthLimit);
  const wouldExceed = wouldExceedDay || wouldExceedMonth;
  const nearLimit = limitInfo && !wouldExceed && (
    (limitInfo.todayCount + plannedRecipientRows >= limitInfo.dailyLimit * 0.8) ||
    (limitInfo.monthCount + plannedRecipientRows >= limitInfo.monthLimit * 0.8)
  );

  const copyContent = () => {
    if (!template) return;
    const text = eligible.map((s) => {
      const vars = { ...studentVars(s), qr_link: `${APP_ORIGIN}/qr?code=${encodeURIComponent(s.code)}`, qr_code_image: "" };
      return `To: ${selectedEmails.join(", ")}\nSubject: ${fillTemplate(template.subject, vars)}\n\n${fillTemplate(bodyFor(s), vars)}`;
    }).join("\n\n---\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const send = async () => {
    setSending(true);
    setError("");
    // Only edited bodies are sent; the rest are filled from the saved template
    // server-side exactly as before.
    const bodyOverrides = {};
    for (const s of eligible) {
      if (bodies[s.code] !== undefined && bodies[s.code] !== defaultBody(s) && bodies[s.code].trim()) bodyOverrides[s.code] = bodies[s.code];
    }
    const { error: fnErr } = await supabase.functions.invoke("send-approval-email", {
      body: { guardianEmails: selectedEmails, students: eligible, includeBcc: bccChecked, bodyOverrides },
    });
    setSending(false);
    if (fnErr) { setError("Something went wrong sending — you can try again, or check with the parent directly."); return; }
    setSent(true);
    setTimeout(() => onSent(), 1200);
  };

  if (!guardianEmails || guardianEmails.length === 0) {
    return (
      <Modal title="No confirmation email sent" onClose={onCancel}>
        <p style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }}>No guardian email is on file for this request, so there's nothing to send to. The student{students.length > 1 ? "s were" : " was"} still created normally.</p>
        <div className="flex justify-end mt-4"><Btn onClick={onCancel}>Close</Btn></div>
      </Modal>
    );
  }

  if (eligible.length === 0) {
    return (
      <Modal title="No confirmation email sent" onClose={onCancel}>
        <p style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }}>None of the newly created students were booked into a class, so there's nothing to confirm by email yet. You can book them from the Students tab, and email them separately once they're scheduled.</p>
        <div className="flex justify-end mt-4"><Btn onClick={onCancel}>Close</Btn></div>
      </Modal>
    );
  }

  return (
    <Modal title="Confirm before sending" onClose={onCancel} wide>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10, lineHeight: 1.5 }}>
        Review exactly what will be emailed. Nothing sends until you confirm — safe to cancel if you're just testing, or if this shouldn't go out yet.
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
          <Btn size="sm" variant="ghost" onClick={copyContent} disabled={!template}>{copied ? "Copied ✓" : "📋 Copy email content"}</Btn>
        </div>
      )}
      {nearLimit && (
        <p style={{ fontSize: 12, color: T.gold, marginBottom: 12 }}>
          ⚠ Getting close to {limitInfo.todayCount + plannedRecipientRows >= limitInfo.dailyLimit * 0.8 ? "today's" : "this month's"} email limit — {limitInfo.todayCount + plannedRecipientRows} of {limitInfo.dailyLimit} today, {limitInfo.monthCount + plannedRecipientRows} of {limitInfo.monthLimit} this month.
        </p>
      )}

      {skipped.length > 0 && (
        <p style={{ fontSize: 12, color: T.gold, marginBottom: 10 }}>
          Not included: {skipped.map((s) => s.name).join(", ")} — not booked into a class yet.
        </p>
      )}

      {bccEmail && (
        <label className="flex items-center gap-2 mb-3" style={{ fontSize: 12.5, color: T.ink }}>
          <input type="checkbox" checked={bccChecked} onChange={(e) => setBccChecked(e.target.checked)} />
          Bcc {bccEmail} on {eligible.length > 1 ? "these emails" : "this email"}
        </label>
      )}

      {!template ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>Loading template…</p>
      ) : (
        <div className="grid gap-4" style={{ maxHeight: 420, overflowY: "auto" }}>
          {eligible.map((s) => {
            const qrLink = `${APP_ORIGIN}/qr?code=${encodeURIComponent(s.code)}`;
            const subject = fillTemplate(template.subject, studentVars(s));
            const body = bodyFor(s);
            const isEditing = editing.has(s.code);
            const edited = bodies[s.code] !== undefined && bodies[s.code] !== defaultBody(s);
            return (
              <div key={s.code} style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 6 }}>
                  <div><strong>To:</strong> {selectedEmails.join(", ") || "(nobody selected)"}</div>
                  {bccChecked && bccEmail && <div><strong>Bcc:</strong> {bccEmail}</div>}
                  <div><strong>Subject:</strong> {subject}</div>
                </div>
                <div className="flex items-center justify-between gap-2" style={{ marginBottom: 6 }}>
                  <button type="button" onClick={() => toggleEditing(s.code)} style={{ fontSize: 12, fontWeight: 600, color: T.maroon }}>
                    {isEditing ? "Done editing" : "✏️ Edit wording"}
                  </button>
                  {edited && (
                    <button type="button" onClick={() => setBodies((cur) => { const next = { ...cur }; delete next[s.code]; return next; })} style={{ fontSize: 11.5, color: T.inkSoft, textDecoration: "underline" }}>
                      Reset to saved template
                    </button>
                  )}
                </div>
                {isEditing && (
                  <>
                    <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 4 }}>
                      Edit for this send only — the saved template in Admin Config doesn't change. Keep <code>{"{{qr_link}}"}</code> and <code>{"{{qr_code_image}}"}</code> where the link and QR code should go.
                    </div>
                    <textarea
                      style={{ ...inputStyle, minHeight: 180, fontFamily: "monospace", fontSize: 12.5, lineHeight: 1.5, marginBottom: 8 }}
                      value={body}
                      onChange={(e) => setBodies((cur) => ({ ...cur, [s.code]: e.target.value }))}
                    />
                  </>
                )}
                <div
                  style={{ fontSize: 13, color: T.ink, lineHeight: 1.6, marginBottom: 10, background: T.paper, borderRadius: 6, padding: 10 }}
                  dangerouslySetInnerHTML={{ __html: previewHtml(body, qrLink) }}
                />
                <div className="flex items-center gap-2">
                  <div style={{ border: `1px solid ${T.line}`, borderRadius: 6, padding: 4 }}>
                    <QrCanvas text={qrLink} size={80} />
                  </div>
                  <span style={{ fontSize: 11, color: T.inkSoft }}>Attached as an image in the actual email</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && <p style={{ color: T.terracotta, fontSize: 13, marginTop: 10 }}>{error}</p>}
      {sent && <p style={{ color: T.sage, fontSize: 13, marginTop: 10, fontWeight: 600 }}>Sent.</p>}
      <div className="flex justify-end gap-2 mt-4">
        <Btn variant="ghost" onClick={onCancel} disabled={sending}>Cancel — don't send</Btn>
        <Btn variant="success" onClick={send} disabled={sending || sent || !template || !limitLoaded || selectedEmails.length === 0 || wouldExceed}>
          {sending ? "Sending…" : !template || !limitLoaded ? "Loading…" : `Send ${eligible.length} email${eligible.length === 1 ? "" : "s"}`}
        </Btn>
      </div>
    </Modal>
  );
}
