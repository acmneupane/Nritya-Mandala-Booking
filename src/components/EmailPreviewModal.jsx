import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { Btn, Modal } from "./ui";
import { QrCanvas } from "./QrCode";
import { formatTimeRange } from "../lib/scheduling";

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

// Shows exactly what's about to be emailed — subject, recipient, body, and the QR
// attachment — before it actually sends, so nothing goes out by accident (e.g. while
// testing, or for a request where no email was actually given).
export default function EmailPreviewModal({ guardianEmail, students, onCancel, onSent }) {
  const [template, setTemplate] = useState(null);
  const [bccEmail, setBccEmail] = useState(null);
  const [bccChecked, setBccChecked] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("email_templates").select("subject, body").eq("key", "enrollment_approved").maybeSingle()
      .then(({ data }) => setTemplate(data));
    supabase.functions.invoke("send-approval-email", { method: "GET" })
      .then(({ data }) => setBccEmail(data?.bccEmail || null))
      .catch(() => setBccEmail(null));
  }, []);

  const eligible = students.filter((s) => s.day && s.startDate && s.code);
  const skipped = students.filter((s) => !(s.day && s.startDate && s.code));

  const send = async () => {
    setSending(true);
    setError("");
    const { error: fnErr } = await supabase.functions.invoke("send-approval-email", {
      body: { guardianEmail, students: eligible, includeBcc: bccChecked },
    });
    setSending(false);
    if (fnErr) { setError("Something went wrong sending — you can try again, or check with the parent directly."); return; }
    setSent(true);
    setTimeout(() => onSent(), 1200);
  };

  if (!guardianEmail) {
    return (
      <Modal title="No confirmation email sent" onClose={onCancel}>
        <p style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }}>This request didn't include a guardian email, so there's nothing to send to. The student{students.length > 1 ? "s were" : " was"} still created normally.</p>
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
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        Review exactly what will be emailed. Nothing sends until you confirm — safe to cancel if you're just testing, or if this shouldn't go out yet.
      </p>

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
            const qrLink = `${window.location.origin}/qr?code=${encodeURIComponent(s.code)}`;
            const vars = {
              student_name: s.name,
              day: s.day,
              time: formatTimeRange(s.time, s.endTime),
              start_date: formatDate(s.startDate),
              qr_link: qrLink,
              qr_code_image: "",
            };
            const subject = fillTemplate(template.subject, vars);
            const body = fillTemplate(template.body, vars);
            return (
              <div key={s.code} style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 6 }}>
                  <div><strong>To:</strong> {guardianEmail}</div>
                  {bccChecked && bccEmail && <div><strong>Bcc:</strong> {bccEmail}</div>}
                  <div><strong>Subject:</strong> {subject}</div>
                </div>
                <div
                  style={{ fontSize: 13, color: T.ink, lineHeight: 1.6, marginBottom: 10, background: T.paper, borderRadius: 6, padding: 10 }}
                  dangerouslySetInnerHTML={{ __html: body.replace("{{qr_link}}", qrLink).replace(/\n/g, "<br/>") }}
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
        <Btn onClick={send} disabled={sending || sent || !template}>
          {sending ? "Sending…" : `Send ${eligible.length} email${eligible.length === 1 ? "" : "s"}`}
        </Btn>
      </div>
    </Modal>
  );
}
