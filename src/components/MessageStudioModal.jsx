import { useState } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Field, Modal } from "./ui";
import TurnstileWidget from "./TurnstileWidget";

// Small popup so a parent can ask the studio something without leaving the
// portal or finding a separate contact method — submits through the same
// Turnstile-gated submit-form edge function as the public homepage's contact
// form (formType "contact" -> submit_contact_message), so nothing bypasses
// that anti-bot gate just because it's launched from inside the parent app.
// The message body is prefixed with the student's name/code since
// submit_contact_message has no student_id column — that's how the studio
// knows which family a message is about.
export default function MessageStudioModal({ student, onClose }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim() || !message.trim()) { setError("Please fill in your name and a message."); return; }
    setError("");
    setSubmitting(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("submit-form", {
        body: {
          turnstileToken,
          formType: "contact",
          params: {
            p_name: name.trim(),
            p_email: email.trim() || null,
            p_phone: phone.trim() || null,
            p_message: `Regarding ${student.name} (${student.code}):\n${message.trim()}`,
          },
        },
      });
      if (fnErr || !data?.ok) throw new Error(data?.error || "Something went wrong sending your message — please try again.");
      setSent(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <Modal title="Message sent" onClose={onClose}>
        <p style={{ fontSize: 13, color: T.sage, fontWeight: 700, textAlign: "center", padding: "10px 0" }}>
          Thanks — we've received your message and will be in touch soon.
        </p>
        <div className="flex justify-end mt-2"><Btn onClick={onClose}>Close</Btn></div>
      </Modal>
    );
  }

  return (
    <Modal title="Message the studio" onClose={onClose}>
      <Field label="Your name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Email (optional)"><input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Phone (optional)"><input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      </div>
      <Field label="Message">
        <textarea style={{ ...inputStyle, minHeight: 100 }} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={`Ask us anything about ${student.name}'s classes…`} />
      </Field>
      {error && <p style={{ color: T.terracotta, fontSize: 13, marginTop: 4 }}>{error}</p>}
      <TurnstileWidget onVerify={setTurnstileToken} />
      <div className="flex justify-end gap-2 mt-2">
        <Btn variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Btn>
        <Btn onClick={submit} disabled={submitting || !turnstileToken}>{submitting ? "Sending…" : "Send message"}</Btn>
      </div>
    </Modal>
  );
}
