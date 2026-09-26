import { T } from "../lib/theme";
import { Field, FileInput } from "./ui";
import { FieldWrap, YesNoChoice } from "./Validation";

// "Have you made the payment?" — a required Yes / No on the enrolment and
// renewal forms, below the bank details and reference.
// Yes: asks for a screenshot (helps the studio match the payment faster).
// No: explains the request may be delayed and a spot can't be guaranteed yet.
// answer: "" | "yes" | "no". kind: "enrolment" | "renewal" (wording only).
export default function PaymentConfirmation({ total, answer, onAnswer, file, onFile, problem, kind = "enrolment" }) {
  const amount = total > 0 ? ` of $${total.toFixed(2)}` : "";
  const requestWord = kind === "renewal" ? "renewal" : "enrolment";

  return (
    <div style={{ marginBottom: 6 }}>
      <FieldWrap id="payment" problem={problem}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: T.maroonDark, lineHeight: 1.45, marginBottom: 10 }}>
          Have you made the payment{amount} to the bank account above? <span style={{ color: T.terracotta }}>*</span>
        </div>
        <YesNoChoice value={answer} onChange={onAnswer} />
      </FieldWrap>

      {answer === "yes" && (
        <div className="rounded-xl" style={{ background: `${T.sage}14`, border: `1px solid ${T.sage}66`, padding: "14px 16px", marginTop: 12 }}>
          <p style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.55, marginBottom: 10 }}>
            Thank you! Please upload a screenshot of your payment below — it helps us identify your payment quickly and fast-track your {requestWord} request.
          </p>
          <Field label="Payment screenshot">
            <FileInput file={file} onChange={onFile} accept="image/*,.pdf" />
          </Field>
        </div>
      )}

      {answer === "no" && (
        <div className="rounded-xl" style={{ background: `${T.gold}20`, border: `2px solid ${T.gold}`, padding: "14px 16px", marginTop: 12 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: T.maroonDark, lineHeight: 1.55, marginBottom: 8 }}>
            Please note that your {requestWord} request may be delayed until payment is received.
          </p>
          <p style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.55 }}>
            Our classes are filling quickly, and we're unable to guarantee a place until payment has been confirmed. You're welcome to submit your request now — please make the payment as soon as possible using the reference above, and we'll be in touch.
          </p>
        </div>
      )}
    </div>
  );
}
