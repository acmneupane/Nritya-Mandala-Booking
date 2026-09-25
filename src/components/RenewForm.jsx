import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { useLogoUrl } from "../lib/logo";
import { Btn, Field, Select } from "./ui";
import TurnstileWidget from "./TurnstileWidget";
import { classesLabel } from "../lib/format";
import { formatTimeRange, compareClassSchedule } from "../lib/scheduling";
import { fetchOpenClasses, classOptionLabel } from "../lib/classAvailability";
import { localDateStr } from "../lib/dates";
import { FieldWrap, FormErrorBox } from "./Validation";
import PaymentConfirmation from "./PaymentConfirmation";
import { problemsMessage, scrollToFirstProblem, SECURITY_CHECK_PENDING } from "../lib/validation";

// Shown for a student who isn't currently booked into a class — same picker as the
// enrolment form's "Preferred class" field, so a renewing student without a class
// (e.g. reactivated after a pause) can ask for one at the same time.
function PreferredClassField({ classes, today, classId, onChangeClassId, text, onChangeText }) {
  if (classes.length === 0) {
    return (
      <Field label="Preferred day/time (optional)">
        <input style={inputStyle} value={text} onChange={(e) => onChangeText(e.target.value)} placeholder="e.g. Saturday mornings, Tuesday evenings" />
      </Field>
    );
  }
  return (
    <Field label="Preferred class *">
      <Select value={classId} onChange={(e) => onChangeClassId(e.target.value)}>
        <option value="" disabled>Select a class…</option>
        {classes.map((c) => <option key={c.id} value={c.id}>{classOptionLabel(c, today)}</option>)}
        <option value="none">No preference</option>
      </Select>
      <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>We'll do our best to accommodate your preference, though the final class will be confirmed by the studio.</p>
    </Field>
  );
}

export default function RenewForm() {
  const logoUrl = useLogoUrl();
  const today = localDateStr(new Date());
  const code = new URLSearchParams(window.location.search).get("code") || "";
  const [student, setStudent] = useState(undefined); // undefined = loading, null = not found
  const [siblings, setSiblings] = useState([]); // other family members, from get_family_students
  const [tiers, setTiers] = useState([]);
  const [selectedTierId, setSelectedTierId] = useState(""); // primary student's tier
  const [includedSiblings, setIncludedSiblings] = useState({}); // { [siblingId]: true }
  const [siblingTierIds, setSiblingTierIds] = useState({}); // { [siblingId]: tierId }
  const [dobEdits, setDobEdits] = useState({}); // { [studentId]: "YYYY-MM-DD" } - current value shown, may differ from what's on file
  const [originalDobs, setOriginalDobs] = useState({}); // { [studentId]: "YYYY-MM-DD" or "" } - what's actually on file, to detect a real change
  const [classes, setClasses] = useState([]); // open classes with room, for students not currently booked into one
  const [currentClassesByStudent, setCurrentClassesByStudent] = useState({}); // { [studentId]: [{label, day, time, end_time}] } — their existing booking(s), if any
  const [preferredClassIds, setPreferredClassIds] = useState({}); // { [studentId]: classId | "none" }
  const [preferredClassTexts, setPreferredClassTexts] = useState({}); // { [studentId]: text } - used when there are no classes to pick from yet
  const [paymentAnswer, setPaymentAnswer] = useState(""); // "" | "yes" | "no" — "Have you made the payment?"
  const [agreedToPolicies, setAgreedToPolicies] = useState(false);
  const [paymentFile, setPaymentFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // Set on the first Submit click; from then on every problem is highlighted
  // live (and clears as it's fixed).
  const [attempted, setAttempted] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const [bankDetails, setBankDetails] = useState(null);

  useEffect(() => {
    if (!code) { setStudent(null); return; }
    const upperCode = code.trim().toUpperCase();

    supabase.from("package_tiers").select("*").eq("active", true).eq("available_for_renewal", true).order("sort_order").then(({ data }) => setTiers(data || []));

    supabase.from("admin_settings").select("bank_name, bank_account_name, bank_bsb, bank_account_number").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setBankDetails(data);
    });

    fetchOpenClasses().then((open) => setClasses(open.slice().sort(compareClassSchedule)));

    Promise.all([
      supabase.from("student_public").select("id, code, name, dob").eq("code", upperCode).maybeSingle(),
      supabase.rpc("get_family_students", { p_code: upperCode }),
    ]).then(([sRes, gRes]) => {
      const data = sRes.data;
      setStudent(data || null);
      if (!data) return;
      setDobEdits((m) => ({ ...m, [data.id]: data.dob || "" }));
      setOriginalDobs((m) => ({ ...m, [data.id]: data.dob || "" }));

      const others = (gRes.data || []).filter((s) => s.code.toUpperCase() !== upperCode);
      setSiblings(others);
      const dobMap = {};
      others.forEach((s) => { dobMap[s.id] = s.dob || ""; });
      setDobEdits((m) => ({ ...m, ...dobMap }));
      setOriginalDobs((m) => ({ ...m, ...dobMap }));

      const allIds = [data.id, ...others.map((s) => s.id)];
      supabase.from("enrollments").select("student_id, classes(label, day, time, end_time)").in("student_id", allIds).then(({ data: enr }) => {
        const map = {};
        (enr || []).forEach((e) => { if (e.classes) (map[e.student_id] ||= []).push(e.classes); });
        setCurrentClassesByStudent(map);
      });
    });
  }, [code]);

  const tierById = Object.fromEntries(tiers.map((t) => [t.id, t]));
  const siblingPrice = (tier) => (tier.sibling_price != null ? Number(tier.sibling_price) : Number(tier.price));

  const includedSiblingList = siblings.filter((s) => includedSiblings[s.id]);
  const total = (selectedTierId && tierById[selectedTierId] ? Number(tierById[selectedTierId].price) : 0)
    + includedSiblingList.reduce((sum, s) => sum + (siblingTierIds[s.id] && tierById[siblingTierIds[s.id]] ? siblingPrice(tierById[siblingTierIds[s.id]]) : 0), 0);

  const referenceCodes = [student?.code, ...includedSiblingList.filter((s) => siblingTierIds[s.id]).map((s) => s.code)].filter(Boolean).join(" ");

  const toggleSibling = (id, checked) => {
    setIncludedSiblings((m) => ({ ...m, [id]: checked }));
    if (!checked) setSiblingTierIds((m) => { const next = { ...m }; delete next[id]; return next; });
  };

  // Whether to show/submit a class preference at all — true for any student with
  // no current class, regardless of whether there happen to be open classes to
  // pick from right now (in which case the field falls back to free text, same as
  // the enrolment form).
  const needsPreferredClass = (studentId) => !currentClassesByStudent[studentId]?.length;
  // Only when there's an actual list to pick from is a selection required —
  // the free-text fallback (no open classes) is optional, matching the enrolment form.
  const missingPreferredClass = (studentId) => needsPreferredClass(studentId) && classes.length > 0 && !preferredClassIds[studentId];

  // Every problem at once, keyed by field, in page order (see lib/validation.js).
  const validate = () => {
    const p = {};
    if (!student) return p;
    if (missingPreferredClass(student.id)) p.primaryClass = `Please choose a preferred class for ${student.name} — or “No preference” if any works.`;
    if (!selectedTierId) p.primaryPackage = `Please select a package for ${student.name}.`;
    includedSiblingList.forEach((s) => {
      if (missingPreferredClass(s.id)) p[`sib-${s.id}-class`] = `Please choose a preferred class for ${s.name} — or “No preference”.`;
      if (!siblingTierIds[s.id]) p[`sib-${s.id}-package`] = `Please select a package for ${s.name}, or untick them.`;
    });
    if (!paymentAnswer) p.payment = "Please let us know whether you've made the payment.";
    if (!agreedToPolicies) p.agreedToPolicies = "Please confirm you agree to the Privacy Policy, Terms & Conditions, and House Rules.";
    return p;
  };
  const problems = attempted ? validate() : {};

  const answerPayment = (answer) => {
    setPaymentAnswer(answer);
    if (answer !== "yes") setPaymentFile(null);
  };

  const handleSubmitClick = () => {
    setAttempted(true);
    setError("");
    const found = validate();
    if (Object.keys(found).length > 0) { scrollToFirstProblem(found); return; }
    if (!turnstileToken) { setError(SECURITY_CHECK_PENDING); return; }
    submit();
  };

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      let screenshotPath = null;
      if (paymentAnswer === "yes" && paymentFile) {
        const ext = paymentFile.name.split(".").pop() || "png";
        screenshotPath = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("payment-screenshots").upload(screenshotPath, paymentFile);
        if (uploadErr) throw new Error("Couldn't upload the payment screenshot — please try again.");
      }

      const preferredFor = (studentId) => {
        if (!needsPreferredClass(studentId)) return {};
        const classId = preferredClassIds[studentId];
        return {
          preferred_class_id: classId && classId !== "none" ? classId : null,
          preferred_class_text: (preferredClassTexts[studentId] || "").trim() || null,
        };
      };

      const selections = [
        { code: student.code, tier_id: selectedTierId, is_sibling: false, corrected_dob: dobEdits[student.id] !== originalDobs[student.id] ? (dobEdits[student.id] || null) : null, ...preferredFor(student.id) },
        ...includedSiblingList.map((s) => ({ code: s.code, tier_id: siblingTierIds[s.id], is_sibling: true, corrected_dob: dobEdits[s.id] !== originalDobs[s.id] ? (dobEdits[s.id] || null) : null, ...preferredFor(s.id) })),
      ];

      const { data: fnData, error: fnErr } = await supabase.functions.invoke("submit-form", {
        body: {
          turnstileToken,
          formType: "renewal",
          params: { p_selections: selections, p_payment_claimed: paymentAnswer === "yes", p_payment_screenshot_path: screenshotPath },
        },
      });
      if (fnErr || !fnData?.ok) throw new Error(fnData?.error || "Something went wrong submitting — please try again.");
      setDone(true);
    } catch (e) {
      setError(e.message && e.message.startsWith("Couldn't upload") ? e.message : e.message || "Something went wrong submitting — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (student === undefined) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }
  if (!student) {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${T.maroon}, ${T.maroonDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", padding: 16 }}>
        <div className="rounded-[1.75rem] shadow-2xl" style={{ background: T.ivory, padding: "36px 28px", width: "100%", maxWidth: 360, textAlign: "center", boxSizing: "border-box" }}>
          <p style={{ color: T.terracotta, fontSize: 14 }}>This link isn't valid — check with the studio for a fresh one.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${T.maroon}, ${T.maroonDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", padding: 16 }}>
        <div className="rounded-[1.75rem] shadow-2xl" style={{ background: T.ivory, padding: "40px 28px", width: "100%", maxWidth: 380, textAlign: "center", boxSizing: "border-box" }}>
          <a href="/" className="hover:opacity-90 transition-opacity" style={{ display: "inline-block", marginBottom: 16 }}>
            <img src={logoUrl} alt="" style={{ width: 72, height: 72, borderRadius: "50%", display: "block" }} />
          </a>
          <h1 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: T.maroonDark, marginBottom: 8, fontWeight: 600 }}>Thank you!</h1>
          <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6 }}>We've received your renewal request. We'll confirm once it's processed.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${T.maroon}, ${T.maroonDark})`, padding: "28px 16px" }} className="sm:py-12">
      <div className="max-w-[460px] sm:max-w-[560px] md:max-w-[680px] lg:max-w-[780px] mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <a href="/" className="hover:opacity-90 transition-opacity shrink-0">
            <img src={logoUrl} alt="" style={{ width: 64, height: 64, borderRadius: "50%", boxShadow: "0 4px 14px rgba(0,0,0,0.25)", display: "block" }} />
          </a>
          <div>
            <h1 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: "#fff", fontWeight: 600, textShadow: "0 2px 10px rgba(0,0,0,0.2)" }}>Renew package</h1>
            <p style={{ fontSize: 12.5, color: T.goldLight, fontWeight: 600 }}>Nritya Mandala</p>
          </div>
        </div>

        <div className="rounded-[1.75rem] shadow-2xl sm:p-10" style={{ background: T.ivory, padding: "26px 20px", boxSizing: "border-box", fontFamily: "Inter, sans-serif" }}>
          <h3 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark, marginBottom: 6, fontWeight: 600 }}>Is this correct?</h3>
          <p style={{ fontSize: 12.5, color: T.inkSoft, marginBottom: 10 }}>Update the date of birth below if it isn't right.</p>
          <a
            href={`/parent?code=${encodeURIComponent(student.code)}`}
            style={{ display: "inline-block", fontSize: 12.5, color: T.gold, textDecoration: "underline", marginBottom: 14, fontWeight: 600 }}
          >
            View {student.name}'s bookings & QR code →
          </a>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Field label="Student's name"><input style={inputStyle} value={student.name} disabled /></Field>
            <Field label="Date of birth"><input style={inputStyle} type="date" value={dobEdits[student.id] || ""} onChange={(e) => setDobEdits((m) => ({ ...m, [student.id]: e.target.value }))} /></Field>
          </div>

          {currentClassesByStudent[student.id]?.length > 0 && (
            <p style={{ fontSize: 12, color: T.inkSoft, marginTop: -8, marginBottom: 14 }}>
              Currently in: {currentClassesByStudent[student.id].map((c) => `${c.label} (${c.day} ${formatTimeRange(c.time, c.end_time)})`).join(", ")}
            </p>
          )}

          {needsPreferredClass(student.id) && (
            <div style={{ marginBottom: 4 }}>
              <div style={{ background: `${T.gold}18`, border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12.5, color: T.ink, lineHeight: 1.5 }}>
                {student.name} isn't currently booked into a class — let us know a preference and we'll get them scheduled.
              </div>
              <FieldWrap id="primaryClass" problem={problems.primaryClass}>
                <PreferredClassField
                  classes={classes}
                  today={today}
                  classId={preferredClassIds[student.id] || ""}
                  onChangeClassId={(v) => setPreferredClassIds((m) => ({ ...m, [student.id]: v }))}
                  text={preferredClassTexts[student.id] || ""}
                  onChangeText={(v) => setPreferredClassTexts((m) => ({ ...m, [student.id]: v }))}
                />
              </FieldWrap>
            </div>
          )}

          <FieldWrap id="primaryPackage" problem={problems.primaryPackage} style={{ marginTop: 12, marginBottom: 12 }}>
          <h3 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark, marginBottom: 8, fontWeight: 600 }}>Select a package <span style={{ color: T.terracotta }}>*</span></h3>
          {tiers.length === 0 ? (
            <p style={{ fontSize: 13, color: T.inkSoft }}>No packages are available to select right now — please contact the studio directly.</p>
          ) : (
            <div className="grid gap-2 mb-4">
              {tiers.map((t) => (
                <label
                  key={t.id}
                  className="transition-colors"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", border: `2px solid ${selectedTierId === t.id ? T.gold : T.line}`,
                    borderRadius: 10, padding: "12px 14px", cursor: "pointer", background: selectedTierId === t.id ? `${T.gold}12` : "#fff",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <input type="radio" name="tier" checked={selectedTierId === t.id} onChange={() => setSelectedTierId(t.id)} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: T.inkSoft }}>{classesLabel(t.classes_count)}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.maroonDark }}>${Number(t.price).toFixed(2)}</div>
                </label>
              ))}
            </div>
          )}
          </FieldWrap>

          {siblings.length > 0 && tiers.length > 0 && (
            <>
              <h3 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark, marginBottom: 10, marginTop: 22, fontWeight: 600 }}>Renewing for another student too?</h3>
              {siblings.map((s) => (
                <div key={s.id} style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <label className="flex items-center gap-2 mb-2" style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>
                    <input type="checkbox" checked={!!includedSiblings[s.id]} onChange={(e) => toggleSibling(s.id, e.target.checked)} />
                    Also renew for {s.name}
                  </label>
                  {includedSiblings[s.id] && (
                    <>
                      <Field label={`${s.name}'s date of birth`}>
                        <input style={inputStyle} type="date" value={dobEdits[s.id] || ""} onChange={(e) => setDobEdits((m) => ({ ...m, [s.id]: e.target.value }))} />
                      </Field>
                      {currentClassesByStudent[s.id]?.length > 0 && (
                        <p style={{ fontSize: 11, color: T.inkSoft, marginTop: -6, marginBottom: 10 }}>
                          Currently in: {currentClassesByStudent[s.id].map((c) => `${c.label} (${c.day} ${formatTimeRange(c.time, c.end_time)})`).join(", ")}
                        </p>
                      )}
                      {needsPreferredClass(s.id) && (
                        <FieldWrap id={`sib-${s.id}-class`} problem={problems[`sib-${s.id}-class`]}>
                          <PreferredClassField
                            classes={classes}
                            today={today}
                            classId={preferredClassIds[s.id] || ""}
                            onChangeClassId={(v) => setPreferredClassIds((m) => ({ ...m, [s.id]: v }))}
                            text={preferredClassTexts[s.id] || ""}
                            onChangeText={(v) => setPreferredClassTexts((m) => ({ ...m, [s.id]: v }))}
                          />
                        </FieldWrap>
                      )}
                      <FieldWrap id={`sib-${s.id}-package`} problem={problems[`sib-${s.id}-package`]}>
                      <div className="grid gap-2">
                      {tiers.map((t) => {
                        const p = siblingPrice(t);
                        const checked = siblingTierIds[s.id] === t.id;
                        return (
                          <label
                            key={t.id}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between", border: `2px solid ${checked ? T.gold : T.line}`,
                              borderRadius: 8, padding: "10px 12px", cursor: "pointer", background: checked ? `${T.gold}12` : "#fff",
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <input type="radio" name={`tier-${s.id}`} checked={checked} onChange={() => setSiblingTierIds((m) => ({ ...m, [s.id]: t.id }))} />
                              <span style={{ fontSize: 13, color: T.ink }}>{t.name} ({classesLabel(t.classes_count)}){t.sibling_price != null && t.sibling_price_label ? ` — ${t.sibling_price_label}` : ""}</span>
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 700, color: T.maroonDark }}>${p.toFixed(2)}</span>
                          </label>
                        );
                      })}
                    </div>
                    </FieldWrap>
                    </>
                  )}
                </div>
              ))}
            </>
          )}

          {tiers.length > 0 && (selectedTierId || includedSiblingList.length > 0) && (
            <div className="flex items-center justify-between" style={{ padding: "10px 0", borderTop: `1px solid ${T.line}`, marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: T.maroonDark, fontFamily: "Fraunces, serif" }}>Total</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: T.maroonDark, fontFamily: "Fraunces, serif" }}>${total.toFixed(2)}</span>
            </div>
          )}

          <div className="rounded-xl shadow-sm" style={{ background: "#fff", border: `1px solid ${T.line}`, padding: "16px 18px", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: T.maroonDark, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>Bank Account Details</div>
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1" style={{ fontSize: 13, color: T.ink, lineHeight: 1.7 }}>
              <p><span style={{ fontWeight: 600 }}>Bank:</span> {bankDetails?.bank_name || "—"}</p>
              <p><span style={{ fontWeight: 600 }}>Account Name:</span> {bankDetails?.bank_account_name || "—"}</p>
              <p><span style={{ fontWeight: 600 }}>BSB:</span> {bankDetails?.bank_bsb || "—"}</p>
              <p><span style={{ fontWeight: 600 }}>Account Number:</span> {bankDetails?.bank_account_number || "—"}</p>
            </div>
          </div>

          <div className="rounded-xl" style={{ background: `${T.gold}20`, border: `2px solid ${T.gold}`, padding: "14px 18px", marginBottom: 14 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: T.maroonDark, lineHeight: 1.5, marginBottom: referenceCodes ? 10 : 0 }}>
              ⚠️ Please pay using the bank details above, with the reference below. Then let us know below whether you've paid — a screenshot of the payment helps us confirm it faster.
            </p>
            {referenceCodes && (
              <>
                <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Payment reference</div>
                <div className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 20, letterSpacing: 1, fontWeight: 700, color: T.maroonDark }}>{referenceCodes}</div>
              </>
            )}
          </div>
          <p style={{ fontSize: 11.5, color: T.inkSoft, marginTop: -8, marginBottom: 14, lineHeight: 1.5 }}>
            Bank transfers can take up to 24 hours to clear, so please allow a little time for your renewal to be confirmed after paying.
          </p>

          <PaymentConfirmation
            total={total}
            answer={paymentAnswer}
            onAnswer={answerPayment}
            file={paymentFile}
            onFile={setPaymentFile}
            problem={problems.payment}
            kind="renewal"
          />

          <div style={{ marginTop: 6, paddingTop: 18, borderTop: `1px solid ${T.gold}33` }}>
            <FieldWrap id="agreedToPolicies" problem={problems.agreedToPolicies} style={{ marginBottom: 6 }}>
            <label className="flex items-start gap-2" style={{ fontSize: 13, color: T.ink, lineHeight: 1.5, fontWeight: 500 }}>
              <input type="checkbox" checked={agreedToPolicies} onChange={(e) => setAgreedToPolicies(e.target.checked)} style={{ marginTop: 2 }} />
              <span>
                I agree to the{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: T.gold, textDecoration: "underline" }}>Privacy Policy</a>
                {", "}
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: T.gold, textDecoration: "underline" }}>Terms &amp; Conditions</a>
                {", and "}
                <a href="/house-rules" target="_blank" rel="noopener noreferrer" style={{ color: T.gold, textDecoration: "underline" }}>House Rules</a>.
              </span>
            </label>
            </FieldWrap>
            <FormErrorBox message={error || problemsMessage(problems)} />
            <TurnstileWidget onVerify={setTurnstileToken} />
            <div style={{ marginTop: 10, textAlign: "right" }}>
              <Btn variant="success" onClick={handleSubmitClick} size="lg" disabled={submitting || tiers.length === 0}>{submitting ? "Submitting…" : "Submit request"}</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
