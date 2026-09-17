import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { classesLabel } from "../lib/format";
import { LOGO_DATA_URI } from "../lib/logo";
import { Btn, Field, ConfirmModal } from "./ui";
import { RELATION_OPTIONS } from "../lib/relations";
import { formatTimeRange } from "../lib/scheduling";

const MAX_SIBLINGS = 2;

function InfoSection({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ fontFamily: "Fraunces, serif", fontSize: 14, color: T.maroonDark, marginBottom: 4 }}>{title}</h4>
      <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function ImportantInfo({ preferredClass }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 18, marginTop: 16 }}>
      <button onClick={() => setOpen((v) => !v)} className="flex items-center justify-between" style={{ width: "100%", textAlign: "left" }}>
        <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark }}>ℹ️ Important Information</h3>
        <span style={{ fontSize: 13, color: T.inkSoft }}>{open ? "Hide ▾" : "Show ▸"}</span>
      </button>
      {!open && <p style={{ fontSize: 12, color: T.inkSoft, marginTop: 6 }}>Location, policies, attendance, and more — please read before submitting.</p>}
      {open && (
        <div style={{ marginTop: 14 }}>
          <InfoSection title="Location & Time">
            72 Central Avenue, Oran Park, NSW 2570<br />
            {preferredClass ? (
              <>Requested time: <strong>{formatTimeRange(preferredClass.time, preferredClass.end_time)}</strong></>
            ) : (
              <span style={{ color: T.inkSoft }}>Select a preferred class above to see its time here.</span>
            )}
          </InfoSection>

          <InfoSection title="Bank Account Details">
            Bank: NAB<br />
            Account Name: Sarita Sigdel<br />
            BSB: 082 231<br />
            Account Number: 846746850<br /><br />
            Payment Reference: use the reference number shown in the Payment section below.
          </InfoSection>

          <InfoSection title="Payment Confirmation">
            After making the payment, please send a screenshot of your payment confirmation to Nritya Mandala. This helps us confirm and process your enrolment.<br /><br />
            <strong>Your student's place in the class will be confirmed once payment has been received.</strong>
          </InfoSection>

          <InfoSection title="Attendance & Punctuality">
            Please arrive at least 5 minutes before class, ready to dance. Regular attendance is encouraged as it helps students keep up with their routines and make the most of their classes. Please let us know if your student will be absent.
          </InfoSection>

          <InfoSection title="Clothing, Shoes & Hair">
            Students should wear comfortable clothing suitable for dancing, such as activewear. Correctly fitting and comfortable dance shoes should be worn — flip-flops are not permitted. Long hair should be neatly tied back and kept away from the face where possible.
          </InfoSection>

          <InfoSection title="Parents & Guardians">
            Parents and guardians are encouraged to remain outside the dance room during classes. This helps minimise distractions and allows students to focus on learning.
          </InfoSection>

          <InfoSection title="Personal Belongings">
            Please avoid bringing valuables, large amounts of cash or unnecessary personal belongings to class. Nritya Mandala accepts no responsibility for belongings that are lost, damaged or stolen.
          </InfoSection>

          <InfoSection title="Cancellation Policy">
            If your student is unable to attend a class, please notify Nritya Mandala at least 24 hours before the scheduled class. Cancellations made less than 24 hours before the class may not be eligible for a make-up class or credit. We understand that emergencies and unexpected circumstances can happen, and these will be considered on a case-by-case basis. Thank you for helping us manage class spaces and provide the best experience for all students.
          </InfoSection>

          <InfoSection title="Safe & Respectful Environment">
            Nritya Mandala is committed to providing a safe, welcoming and non-discriminatory environment for all students, parents and teachers. Bullying, harassment and disrespectful behaviour are not tolerated.
          </InfoSection>
        </div>
      )}
    </div>
  );
}

function SiblingCard({ sibling, index, classes, onChange, onRemove }) {
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft }}>Additional Student {index + 1}</span>
        <button onClick={onRemove} style={{ color: T.terracotta, fontSize: 12 }}>Remove</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Name"><input style={inputStyle} value={sibling.name} onChange={(e) => onChange({ ...sibling, name: e.target.value })} /></Field>
        <Field label="Date of birth"><input style={inputStyle} type="date" value={sibling.dob} onChange={(e) => onChange({ ...sibling, dob: e.target.value })} /></Field>
      </div>
      {classes.length > 0 ? (
        <Field label="Preferred class">
          <select style={inputStyle} value={sibling.classId} onChange={(e) => onChange({ ...sibling, classId: e.target.value })}>
            <option value="">Not sure</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.day} {formatTimeRange(c.time, c.end_time)}</option>)}
          </select>
        </Field>
      ) : (
        <Field label="Preferred day/time (optional)">
          <input style={inputStyle} value={sibling.classText || ""} onChange={(e) => onChange({ ...sibling, classText: e.target.value })} placeholder="e.g. Saturday mornings, Tuesday evenings" />
        </Field>
      )}
    </div>
  );
}

// Radio-card package selector, matching the style used on the renewal page.
function PackageTierPicker({ tiers, selectedId, onSelect, sibling }) {
  return (
    <div className="grid gap-2 mb-2">
      {tiers.map((t) => {
        const price = sibling && t.sibling_price != null ? Number(t.sibling_price) : Number(t.price);
        const checked = selectedId === t.id;
        return (
          <label
            key={t.id}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", border: `2px solid ${checked ? T.gold : T.line}`,
              borderRadius: 8, padding: "10px 12px", cursor: "pointer", background: checked ? `${T.gold}12` : "#fff",
            }}
          >
            <div className="flex items-center gap-2">
              <input type="radio" checked={checked} onChange={() => onSelect(t.id)} />
              <span style={{ fontSize: 13, color: T.ink }}>{t.name} ({classesLabel(t.classes_count)}){sibling && t.sibling_price != null && t.sibling_price_label ? ` — ${t.sibling_price_label}` : ""}</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.maroonDark }}>${price.toFixed(2)}</span>
          </label>
        );
      })}
    </div>
  );
}

export default function EnrollForm() {
  const [classes, setClasses] = useState([]);
  const [studentName, setStudentName] = useState("");
  const [studentDob, setStudentDob] = useState("");
  const [preferredClassId, setPreferredClassId] = useState("");
  const [preferredClassText, setPreferredClassText] = useState("");
  const [packageTierId, setPackageTierId] = useState("");
  const [packageTiers, setPackageTiers] = useState([]);
  const [fees, setFees] = useState({ primary: 20, sibling: 15, enabled: false, label: "One-off Enrolment fee" });
  const [guardianName, setGuardianName] = useState("");
  const [guardianRelation, setGuardianRelation] = useState("");
  const [guardianRelationOther, setGuardianRelationOther] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [emergencySame, setEmergencySame] = useState(true);
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [wantsSiblings, setWantsSiblings] = useState(false);
  const [siblings, setSiblings] = useState([]);
  const [videoConsent, setVideoConsent] = useState(null); // null = unanswered, true/false = Yes/No
  const [agreedToInfo, setAgreedToInfo] = useState(false);
  const [notes, setNotes] = useState("");
  const [paymentClaimed, setPaymentClaimed] = useState(false);
  const [paymentFile, setPaymentFile] = useState(null);
  const [paymentReference, setPaymentReference] = useState(null);
  const [generatingReference, setGeneratingReference] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("classes").select("id, label, day, time, end_time, capacity"),
      supabase.rpc("get_effective_class_counts"),
    ]).then(([cRes, eRes]) => {
      const counts = {};
      (eRes.data || []).forEach((row) => { counts[row.class_id] = Number(row.effective_count); });
      const open = (cRes.data || []).filter((c) => (counts[c.id] || 0) < c.capacity);
      setClasses(open.slice().sort((a, b) => a.day.localeCompare(b.day) || a.time.localeCompare(b.time)));
    });
    supabase.from("package_tiers").select("*").eq("active", true).order("sort_order").then(({ data }) => setPackageTiers(data || []));
    supabase.from("settings").select("enrolment_fee_enabled, enrolment_fee_label, enrolment_fee_primary, enrolment_fee_sibling").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setFees({ primary: Number(data.enrolment_fee_primary), sibling: Number(data.enrolment_fee_sibling), enabled: data.enrolment_fee_enabled, label: data.enrolment_fee_label });
    });
    // The reference is shown up front — it's what they need to actually make the
    // payment with, not just a receipt after the fact — so generate it immediately
    // rather than waiting for "I have paid" to be ticked.
    setGeneratingReference(true);
    supabase.rpc("peek_enrollment_reference").then(({ data, error }) => {
      setGeneratingReference(false);
      if (!error) setPaymentReference(data);
    });
  }, []);

  const addSibling = () => {
    if (siblings.length >= MAX_SIBLINGS) return;
    setSiblings((s) => [...s, { name: "", dob: "", classId: "", classText: "", packageTierId: "" }]);
  };
  const updateSibling = (i, val) => setSiblings((s) => s.map((sib, idx) => (idx === i ? val : sib)));
  const removeSibling = (i) => setSiblings((s) => s.filter((_, idx) => idx !== i));

  const togglePaymentClaimed = (checked) => {
    setPaymentClaimed(checked);
    if (!checked) setPaymentFile(null);
  };

  const namedSiblings = siblings.filter((s) => s.name.trim());
  const tierById = Object.fromEntries(packageTiers.map((t) => [t.id, t]));
  const siblingTierPrice = (tier) => (tier.sibling_price != null ? Number(tier.sibling_price) : Number(tier.price));
  const primaryTierPrice = packageTierId && tierById[packageTierId] ? Number(tierById[packageTierId].price) : 0;
  const packageTotal = classes.length > 0
    ? primaryTierPrice + namedSiblings.reduce((sum, s) => sum + (s.packageTierId && tierById[s.packageTierId] ? siblingTierPrice(tierById[s.packageTierId]) : 0), 0)
    : 0;
  const enrolmentFeeTotal = fees.enabled ? fees.primary + namedSiblings.length * fees.sibling : 0;
  const total = enrolmentFeeTotal + packageTotal;

  const [confirmUnpaid, setConfirmUnpaid] = useState(false);

  const validate = () => {
    if (!studentName.trim() || !guardianName.trim()) {
      return "Student name and your name are required.";
    }
    if (!emergencySame && (!emergencyName.trim() || !emergencyPhone.trim())) {
      return "Please provide an emergency contact name and phone, or mark it the same as yours.";
    }
    if (videoConsent === null) {
      return "Please answer the photo/video consent question.";
    }
    if (!agreedToInfo) {
      return "Please confirm you've read the Important Information above.";
    }
    if (classes.length > 0) {
      if (!packageTierId) return "Please select a package for " + (studentName || "the student") + ".";
      const missingSiblingPackage = namedSiblings.find((s) => !s.packageTierId);
      if (missingSiblingPackage) return `Please select a package for ${missingSiblingPackage.name}.`;
    }
    return null;
  };

  const handleSubmitClick = () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setError("");
    // Nothing to pay right now, or they've already indicated payment — go straight
    // through. Otherwise, a quick check-in first, since an unpaid submission may
    // take longer to process.
    const somethingToPay = classes.length > 0 || fees.enabled;
    if (somethingToPay && !paymentClaimed) {
      setConfirmUnpaid(true);
      return;
    }
    submit();
  };

  const submit = async () => {
    setConfirmUnpaid(false);
    setSubmitting(true);
    setError("");
    try {
      let screenshotPath = null;
      if (paymentClaimed && paymentFile) {
        const ext = paymentFile.name.split(".").pop() || "png";
        screenshotPath = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("payment-screenshots").upload(screenshotPath, paymentFile);
        if (uploadErr) throw new Error("Couldn't upload the payment screenshot — please try again.");
      }

      const studentRows = [
        { name: studentName.trim(), dob: studentDob || null, preferred_class_id: preferredClassId || null, preferred_class_text: preferredClassText.trim() || null, selected_package_tier_id: packageTierId || null, is_sibling: false, sort_order: 0 },
        ...namedSiblings.map((s, i) => ({
          name: s.name.trim(), dob: s.dob || null, preferred_class_id: s.classId || null, preferred_class_text: (s.classText || "").trim() || null, selected_package_tier_id: s.packageTierId || null, is_sibling: true, sort_order: i + 1,
        })),
      ];

      const { data, error: rpcErr } = await supabase.rpc("submit_enrollment_request", {
        p_guardian_name: guardianName.trim(),
        p_guardian_relation: guardianRelation === "Other" ? (guardianRelationOther.trim() || "Other") : guardianRelation,
        p_guardian_email: guardianEmail.trim(),
        p_guardian_phone: guardianPhone.trim(),
        p_emergency_same: emergencySame,
        p_emergency_name: emergencySame ? "" : emergencyName.trim(),
        p_emergency_phone: emergencySame ? "" : emergencyPhone.trim(),
        p_video_consent: videoConsent,
        p_notes: notes.trim(),
        p_payment_claimed: paymentClaimed,
        p_payment_screenshot_path: screenshotPath,
        p_reference: paymentReference,
        p_students: studentRows,
      });
      if (rpcErr) throw rpcErr;

      setReference(data.reference);
    } catch (e) {
      setError(e.message && e.message.startsWith("Couldn't upload") ? e.message : "Something went wrong submitting — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (reference) {
    return (
      <div style={{ minHeight: "100vh", background: T.maroon, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", padding: 16 }}>
        <div style={{ background: T.ivory, borderRadius: 12, padding: "40px 28px", width: "100%", maxWidth: 380, textAlign: "center", boxSizing: "border-box" }}>
          <img src={LOGO_DATA_URI} alt="" style={{ width: 60, height: 60, borderRadius: "50%", margin: "0 auto 16px", display: "block" }} />
          <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.maroonDark, marginBottom: 8 }}>Thank you!</h1>
          <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6, marginBottom: 16 }}>
            We've received {studentName}'s enrolment request. We will contact you to confirm the enrolment.
          </p>
          <div style={{ background: `${T.gold}18`, border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "14px 18px", marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 2 }}>Your payment reference</div>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, letterSpacing: 1, fontWeight: 700, color: T.maroonDark }}>{reference}</div>
          </div>
          <p style={{ fontSize: 12, color: T.inkSoft, lineHeight: 1.5 }}>Please use this reference when making your payment, and keep it handy in case we need to follow up.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.maroon, padding: "24px 16px" }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <div className="flex items-center gap-2 mb-4">
          <img src={LOGO_DATA_URI} alt="" style={{ width: 44, height: 44, borderRadius: "50%" }} />
          <div>
            <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: T.ivory }}>Enrol a student</h1>
            <p style={{ fontSize: 12, color: T.goldLight }}>Nritya Mandala</p>
          </div>
        </div>

        <div style={{ background: T.ivory, borderRadius: 12, padding: "24px 20px", boxSizing: "border-box", fontFamily: "Inter, sans-serif" }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 19, color: T.maroonDark, marginBottom: 6 }}>Welcome to Nritya Mandala! 🪷</h2>
            <p style={{ fontSize: 13, color: T.ink, lineHeight: 1.6 }}>
              We're so glad you're considering joining our dance class. Fill in a few details below and we'll be in touch to confirm everything.
            </p>
          </div>

          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 12 }}>Student details</h3>
          <Field label="Student's name *"><input style={inputStyle} value={studentName} onChange={(e) => setStudentName(e.target.value)} /></Field>
          {classes.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date of birth"><input style={inputStyle} type="date" value={studentDob} onChange={(e) => setStudentDob(e.target.value)} /></Field>
              <Field label="Preferred class">
                <select style={inputStyle} value={preferredClassId} onChange={(e) => setPreferredClassId(e.target.value)}>
                  <option value="">Not sure</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.day} {formatTimeRange(c.time, c.end_time)}</option>)}
                </select>
              </Field>
            </div>
          ) : (
            <>
              <Field label="Date of birth"><input style={inputStyle} type="date" value={studentDob} onChange={(e) => setStudentDob(e.target.value)} /></Field>
              <div style={{ background: `${T.gold}18`, border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12.5, color: T.ink, lineHeight: 1.5 }}>
                We're growing and adding new classes soon! Let us know your preferred day and time below so we can keep you in mind as we plan — we'll reach out as soon as we have a class ready for you.
              </div>
              <Field label="Preferred day/time (optional)">
                <input style={inputStyle} value={preferredClassText} onChange={(e) => setPreferredClassText(e.target.value)} placeholder="e.g. Saturday mornings, Tuesday evenings" />
              </Field>
            </>
          )}

          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, margin: "18px 0 12px" }}>Who's filling this out?</h3>
          <Field label="Your name *"><input style={inputStyle} value={guardianName} onChange={(e) => setGuardianName(e.target.value)} /></Field>
          <Field label="Your relation to the student">
            <select style={inputStyle} value={guardianRelation} onChange={(e) => setGuardianRelation(e.target.value)}>
              <option value="">Select…</option>
              {RELATION_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          {guardianRelation === "Other" && (
            <Field label="Please specify"><input style={inputStyle} value={guardianRelationOther} onChange={(e) => setGuardianRelationOther(e.target.value)} /></Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><input style={inputStyle} type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} /></Field>
            <Field label="Mobile"><input style={inputStyle} value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} /></Field>
          </div>

          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, margin: "18px 0 8px" }}>Emergency contact</h3>
          <div className="flex gap-4 mb-3">
            <label className="flex items-center gap-1.5 text-sm" style={{ color: T.ink }}>
              <input type="radio" checked={emergencySame} onChange={() => setEmergencySame(true)} /> Same as above
            </label>
            <label className="flex items-center gap-1.5 text-sm" style={{ color: T.ink }}>
              <input type="radio" checked={!emergencySame} onChange={() => setEmergencySame(false)} /> Different person
            </label>
          </div>
          {!emergencySame && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name"><input style={inputStyle} value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} /></Field>
              <Field label="Mobile"><input style={inputStyle} value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} /></Field>
            </div>
          )}

          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, margin: "18px 0 8px" }}>Additional Students</h3>
          {!wantsSiblings ? (
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-1.5 text-sm" style={{ color: T.ink }}>
                <input type="radio" checked={!wantsSiblings} onChange={() => setWantsSiblings(false)} /> No additional students to add
              </label>
              <label className="flex items-center gap-1.5 text-sm" style={{ color: T.ink }}>
                <input type="radio" checked={wantsSiblings} onChange={() => setWantsSiblings(true)} /> Yes, add additional students
              </label>
            </div>
          ) : (
            <>
              <button onClick={() => setWantsSiblings(false)} style={{ fontSize: 12, color: T.inkSoft, marginBottom: 8, textDecoration: "underline" }}>Actually, no additional students</button>
              {siblings.map((s, i) => (
                <SiblingCard key={i} sibling={s} index={i} classes={classes} onChange={(val) => updateSibling(i, val)} onRemove={() => removeSibling(i)} />
              ))}
              {siblings.length < MAX_SIBLINGS && (
                <Btn size="sm" variant="ghost" onClick={addSibling}>+ Add additional student ({siblings.length}/{MAX_SIBLINGS})</Btn>
              )}
            </>
          )}

          <Field label="Anything else we should know?"><textarea style={{ ...inputStyle, minHeight: 60, marginTop: 14 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Prior dance experience, scheduling constraints, etc." /></Field>

          <div style={{ marginTop: 16, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: T.ink, display: "block", marginBottom: 6 }}>
              Do you consent to photos/videos of your student taken during class being used by Nritya Mandala for social media?
            </span>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-sm" style={{ color: T.ink }}>
                <input type="radio" checked={videoConsent === true} onChange={() => setVideoConsent(true)} /> Yes
              </label>
              <label className="flex items-center gap-1.5 text-sm" style={{ color: T.ink }}>
                <input type="radio" checked={videoConsent === false} onChange={() => setVideoConsent(false)} /> No
              </label>
            </div>
          </div>

          <p style={{ fontSize: 12, color: T.inkSoft, marginTop: 12 }}>Once submitted, we'll contact you via email or mobile to confirm the enrolment.</p>

          <div style={{ background: `${T.gold}0F`, border: `2px solid ${T.gold}`, borderRadius: 10, padding: 18, marginTop: 16 }}>
            <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark, marginBottom: 8 }}>💳 Payment</h3>
            {(classes.length > 0 || fees.enabled) ? (
              <>
                {classes.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ fontFamily: "Fraunces, serif", fontSize: 15, color: T.maroonDark, marginBottom: 8 }}>Select a package for {studentName || "the student"}</h4>
                    <PackageTierPicker tiers={packageTiers} selectedId={packageTierId} onSelect={setPackageTierId} />
                    {namedSiblings.map((s, i) => (
                      <div key={i} style={{ marginTop: 14 }}>
                        <h4 style={{ fontFamily: "Fraunces, serif", fontSize: 15, color: T.maroonDark, marginBottom: 8 }}>Select a package for {s.name}</h4>
                        <PackageTierPicker tiers={packageTiers} selectedId={s.packageTierId} onSelect={(id) => updateSibling(siblings.indexOf(s), { ...s, packageTierId: id })} sibling />
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginBottom: 14 }}>
                  {fees.enabled && (
                    <div className="flex items-center justify-between" style={{ padding: "6px 0", borderBottom: `1px solid ${T.line}` }}>
                      <span style={{ fontSize: 13, color: T.ink }}>{studentName || "Student"} — {fees.label}</span>
                      <span style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>${fees.primary.toFixed(2)}</span>
                    </div>
                  )}
                  {classes.length > 0 && (
                    <div className="flex items-center justify-between" style={{ padding: "6px 0", borderBottom: `1px solid ${T.line}` }}>
                      <span style={{ fontSize: 13, color: T.ink }}>{studentName || "Student"} — Package{packageTierId && tierById[packageTierId] ? ` (${tierById[packageTierId].name})` : ""}</span>
                      <span style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>{packageTierId && tierById[packageTierId] ? `$${primaryTierPrice.toFixed(2)}` : "—"}</span>
                    </div>
                  )}
                  {namedSiblings.map((s, i) => (
                    <div key={i}>
                      {fees.enabled && (
                        <div className="flex items-center justify-between" style={{ padding: "6px 0", borderBottom: `1px solid ${T.line}` }}>
                          <span style={{ fontSize: 13, color: T.ink }}>{s.name} — {fees.label} (Additional Student)</span>
                          <span style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>${fees.sibling.toFixed(2)}</span>
                        </div>
                      )}
                      {classes.length > 0 && (
                        <div className="flex items-center justify-between" style={{ padding: "6px 0", borderBottom: `1px solid ${T.line}` }}>
                          <span style={{ fontSize: 13, color: T.ink }}>{s.name} — Package{s.packageTierId && tierById[s.packageTierId] ? ` (${tierById[s.packageTierId].name})` : ""}</span>
                          <span style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>{s.packageTierId && tierById[s.packageTierId] ? `$${siblingTierPrice(tierById[s.packageTierId]).toFixed(2)}` : "—"}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-between" style={{ padding: "10px 0 2px" }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: T.maroonDark, fontFamily: "Fraunces, serif" }}>Total</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: T.maroonDark, fontFamily: "Fraunces, serif" }}>${total.toFixed(2)}</span>
                  </div>
                  {classes.length === 0 && (
                    <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>Package cost isn't included yet — there's no class available to book into right now. We'll follow up once one's ready.</p>
                  )}
                </div>

                <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 12, lineHeight: 1.5 }}>
                  Please pay using the bank details above, with the reference below — this is what tells us the payment is for {studentName || "your student"}'s enrolment.
                </p>
                <div style={{ background: "#fff", border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "10px 16px", marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 2 }}>Pay with this reference</div>
                  <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, letterSpacing: 1, fontWeight: 700, color: T.maroonDark }}>
                    {generatingReference ? "Generating…" : paymentReference || "—"}
                  </div>
                </div>
                <label className="flex items-center gap-2 mb-3" style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>
                  <input type="checkbox" checked={paymentClaimed} onChange={(e) => togglePaymentClaimed(e.target.checked)} />
                  I have already paid
                </label>
                {paymentClaimed && (
                  <Field label="Payment screenshot">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setPaymentFile(e.target.files?.[0] || null)}
                      style={{ fontSize: 13 }}
                    />
                  </Field>
                )}
              </>
            ) : (
              <p style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }}>
                No payment is needed right now, since there's no confirmed class yet. Once we confirm a class for you, we'll follow up with payment details and your reference number.
              </p>
            )}
          </div>

          <ImportantInfo preferredClass={classes.find((c) => c.id === preferredClassId) || null} />

          <label className="flex items-start gap-2 mt-2 mb-3" style={{ fontSize: 13, color: T.ink, lineHeight: 1.5, fontWeight: 500 }}>
            <input type="checkbox" checked={agreedToInfo} onChange={(e) => setAgreedToInfo(e.target.checked)} style={{ marginTop: 2 }} />
            <span>I have read and agree to the Important Information above.</span>
          </label>

          {error && <p style={{ color: T.terracotta, fontSize: 13, marginTop: 6 }}>{error}</p>}
          {agreedToInfo && (
            <div style={{ marginTop: 10, textAlign: "right" }}>
              <Btn variant="success" onClick={handleSubmitClick} size="lg" disabled={submitting}>{submitting ? "Submitting…" : "Submit request"}</Btn>
            </div>
          )}
          <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 14 }}>
            <a href="/parent" style={{ color: T.inkSoft, textDecoration: "underline" }}>Already enrolled? Look up bookings</a>
          </p>
        </div>
      </div>
      {confirmUnpaid && (
        <ConfirmModal
          title="Submit without confirming payment?"
          message="You haven't marked this as paid yet. That's completely fine — you can still submit now and pay afterward — but it may take a little longer for us to process your enrolment until payment is confirmed. Continue anyway?"
          confirmLabel="Submit anyway"
          onConfirm={submit}
          onCancel={() => setConfirmUnpaid(false)}
        />
      )}
    </div>
  );
}
