import { useState } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { useLogoUrl } from "../lib/logo";
import { Select } from "./ui";
import TurnstileWidget from "./TurnstileWidget";
import SiteFooter from "./SiteFooter";
import { DAYS, contactShown, isAnswered, functionErrorMessage } from "../lib/forms";

// Renders one admin-built form (Admin → Forms) for filling in: the public
// /forms?code= page, and the admin Preview (preview = true: nothing is sent,
// Submit just shows the thank-you screen with a sample reference).
//
// form: { code, title, intro_html, thank_you_html?, contact_*_mode, questions }.
// The server (submit_form_response) re-checks everything checked here.

const CARD = "rounded-2xl shadow-[0_2px_10px_-4px_rgba(36,27,21,0.1)]";

function Label({ text, required, help }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>
        {text}
        {required && <span style={{ color: T.terracotta }}> *</span>}
      </div>
      {help && <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2, lineHeight: 1.45 }}>{help}</div>}
    </div>
  );
}

function ChoiceRow({ type, checked, onChange, children }) {
  return (
    <label
      className="flex items-center gap-2.5"
      style={{
        border: `1px solid ${checked ? T.gold : T.line}`, background: checked ? `${T.gold}14` : "#fff",
        borderRadius: 8, padding: "9px 12px", fontSize: 14, color: T.ink, cursor: "pointer",
      }}
    >
      <input type={type} checked={checked} onChange={onChange} />
      {children}
    </label>
  );
}

function PillButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minWidth: 52, padding: "9px 16px", borderRadius: 999, fontSize: 14, fontWeight: 600,
        border: `1px solid ${active ? T.maroon : T.line}`,
        background: active ? T.maroon : "#fff", color: active ? "#fff" : T.ink,
      }}
    >
      {children}
    </button>
  );
}

function QuestionInput({ question, value, onChange }) {
  const options = Array.isArray(question.options) ? question.options : [];
  switch (question.type) {
    case "short_text":
      return <input style={inputStyle} value={value || ""} maxLength={500} onChange={(e) => onChange(e.target.value)} />;
    case "long_text":
      return <textarea style={{ ...inputStyle, minHeight: 100 }} value={value || ""} maxLength={5000} onChange={(e) => onChange(e.target.value)} />;
    case "single_choice":
      return (
        <div className="grid gap-2">
          {options.map((o) => (
            <ChoiceRow key={o.id} type="radio" checked={value === o.id} onChange={() => onChange(o.id)}>{o.label}</ChoiceRow>
          ))}
        </div>
      );
    case "multi_choice": {
      const selected = Array.isArray(value) ? value : [];
      const toggle = (id) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
      return (
        <div className="grid gap-2">
          {options.map((o) => (
            <ChoiceRow key={o.id} type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)}>{o.label}</ChoiceRow>
          ))}
        </div>
      );
    }
    case "dropdown":
      return (
        <Select value={value || ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </Select>
      );
    case "yes_no":
      return (
        <div className="flex gap-2">
          <PillButton active={value === "yes"} onClick={() => onChange(value === "yes" ? "" : "yes")}>Yes</PillButton>
          <PillButton active={value === "no"} onClick={() => onChange(value === "no" ? "" : "no")}>No</PillButton>
        </div>
      );
    case "rating":
      return (
        <div>
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4, 5].map((n) => (
              <PillButton key={n} active={value === n} onClick={() => onChange(value === n ? "" : n)}>{n}</PillButton>
            ))}
          </div>
          <div className="flex justify-between" style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 4, maxWidth: 320 }}>
            <span>1 = not really</span><span>5 = very much</span>
          </div>
        </div>
      );
    case "day_time": {
      const selected = Array.isArray(value) ? value : [];
      const toggle = (key) => onChange(selected.includes(key) ? selected.filter((x) => x !== key) : [...selected, key]);
      return (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 13, minWidth: 260 }}>
            <thead>
              <tr>
                <th />
                {options.map((o) => (
                  <th key={o.id} style={{ padding: "4px 8px", color: T.inkSoft, fontWeight: 600, textAlign: "center" }}>{o.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d) => (
                <tr key={d.key} style={{ borderTop: `1px solid ${T.line}` }}>
                  <td style={{ padding: "6px 10px 6px 0", fontWeight: 600, color: T.ink }}>{d.label}</td>
                  {options.map((o) => {
                    const key = `${d.key}:${o.id}`;
                    return (
                      <td key={o.id} style={{ textAlign: "center", padding: "6px 8px" }}>
                        <input type="checkbox" aria-label={`${d.label} ${o.label}`} checked={selected.includes(key)} onChange={() => toggle(key)} style={{ width: 18, height: 18 }} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    default:
      return null;
  }
}

function ContactField({ mode, label, type, value, onChange }) {
  if (mode === "hidden") return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <Label text={label} required={mode === "required"} />
      <input style={inputStyle} type={type} value={value} maxLength={type === "email" ? 200 : 120} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function FormRenderer({ form, preview = false, source = null }) {
  const logoUrl = useLogoUrl();
  const questions = form.questions || [];
  const [answers, setAnswers] = useState({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { reference_code, thank_you_html }

  const showContact = contactShown(form);
  const setAnswer = (id, value) => { setAnswers((cur) => ({ ...cur, [id]: value })); setError(""); };

  const validate = () => {
    for (const q of questions) {
      if (q.required && !isAnswered(answers[q.id])) return `Please answer: ${q.label}`;
    }
    if (form.contact_name_mode === "required" && !name.trim()) return "Please enter your name.";
    if (form.contact_email_mode === "required" && !email.trim()) return "Please enter your email address.";
    if (form.contact_phone_mode === "required" && !phone.trim()) return "Please enter your phone number.";
    if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return "Please enter a valid email address.";
    if (showContact && !consent) return "Please agree to the Privacy Policy to continue.";
    return "";
  };

  const submit = async () => {
    const problem = validate();
    if (problem) { setError(problem); return; }
    if (preview) {
      setResult({ reference_code: "AB12CD", thank_you_html: form.thank_you_html });
      return;
    }
    setError("");
    setSubmitting(true);
    const cleanAnswers = Object.fromEntries(Object.entries(answers).filter(([, v]) => isAnswered(v)));
    const { data, error: fnErr } = await supabase.functions.invoke("submit-form", {
      body: {
        turnstileToken,
        formType: "form",
        params: {
          p_code: form.code,
          p_name: name.trim() || null,
          p_email: email.trim() || null,
          p_phone: phone.trim() || null,
          p_consent: showContact ? consent : null,
          p_answers: cleanAnswers,
          p_source: source,
        },
      },
    });
    setSubmitting(false);
    if (fnErr || !data?.ok) {
      setError(await functionErrorMessage(fnErr, data, "Something went wrong sending your response — please try again."));
      return;
    }
    setResult(data.data);
    window.scrollTo(0, 0);
  };

  return (
    <div style={{ minHeight: "100vh", background: T.ivory, fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "36px 16px 60px" }}>
        {preview && (
          <div style={{ background: `${T.gold}22`, border: `1px solid ${T.gold}66`, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, color: T.maroonDark, marginBottom: 16 }}>
            👁 Preview — this is how the form looks to the public. Nothing is saved when you submit here.
          </div>
        )}
        <a href="/" style={{ display: "inline-block", marginBottom: 16 }}>
          <img src={logoUrl} alt="Nritya Mandala" style={{ width: 52, height: 52, borderRadius: "50%", display: "block" }} />
        </a>
        <h1 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 28, color: T.maroonDark, fontWeight: 600, marginBottom: 16, lineHeight: 1.2 }}>{form.title}</h1>

        {result ? (
          <div className={CARD} style={{ background: "#fff", border: `1px solid ${T.line}`, padding: 24 }}>
            {result.thank_you_html ? (
              <div className="rich-text-content" style={{ fontSize: 14.5, color: T.ink, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: result.thank_you_html }} />
            ) : (
              <p style={{ fontSize: 15, color: T.ink, lineHeight: 1.6 }}>Thank you — we've received your response. 🙏</p>
            )}
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <div style={{ display: "inline-block", background: "#FBF1E0", border: "1px solid #D9B876", borderRadius: 8, padding: "10px 24px" }}>
                <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 2, letterSpacing: 0.5 }}>YOUR REFERENCE</div>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 24, letterSpacing: 3, fontWeight: 700, color: T.maroonDark }}>{result.reference_code}</div>
              </div>
              <p style={{ fontSize: 12, color: T.inkSoft, marginTop: 8 }}>Quote this if you contact us about your response.</p>
            </div>
          </div>
        ) : (
          <div className={CARD} style={{ background: "#fff", border: `1px solid ${T.line}`, padding: 22 }}>
            {form.intro_html && (
              <div className="rich-text-content" style={{ fontSize: 14, color: T.ink, lineHeight: 1.7, marginBottom: 22 }} dangerouslySetInnerHTML={{ __html: form.intro_html }} />
            )}

            {questions.map((q) => (
              <div key={q.id} style={{ marginBottom: 22 }}>
                <Label text={q.label || "Untitled question"} required={q.required} help={q.help_text} />
                <QuestionInput question={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
              </div>
            ))}

            {showContact && (
              <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 18, marginTop: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.gold, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 }}>Your details</div>
                <ContactField mode={form.contact_name_mode} label="Name" type="text" value={name} onChange={setName} />
                <ContactField mode={form.contact_email_mode} label="Email" type="email" value={email} onChange={setEmail} />
                <ContactField mode={form.contact_phone_mode} label="Phone" type="tel" value={phone} onChange={setPhone} />
                <label className="flex items-start gap-2" style={{ fontSize: 13, color: T.ink, lineHeight: 1.5, marginTop: 4 }}>
                  <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setError(""); }} style={{ marginTop: 3 }} />
                  <span>
                    I agree to Nritya Mandala's{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: T.gold, textDecoration: "underline" }}>Privacy Policy</a>
                    , including how my details and answers are used.
                  </span>
                </label>
              </div>
            )}

            {error && <p style={{ color: T.terracotta, fontSize: 13, marginTop: 14 }}>{error}</p>}
            {!preview && <TurnstileWidget onVerify={setTurnstileToken} />}
            <button
              onClick={submit}
              disabled={submitting || (!preview && !turnstileToken)}
              className="hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300"
              style={{
                marginTop: 12, background: T.maroon, color: "#fff", fontWeight: 700, padding: "12px 28px", borderRadius: 999, border: "none", fontSize: 14.5,
                opacity: submitting || (!preview && !turnstileToken) ? 0.6 : 1,
                cursor: submitting || (!preview && !turnstileToken) ? "default" : "pointer",
              }}
            >
              {submitting ? "Sending…" : "Submit"}
            </button>
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
