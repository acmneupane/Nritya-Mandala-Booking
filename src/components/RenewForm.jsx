import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { LOGO_DATA_URI } from "../lib/logo";
import { Btn, Field, ConfirmModal } from "./ui";
import TurnstileWidget from "./TurnstileWidget";
import { classesLabel } from "../lib/format";
import { formatTimeRange, compareClassSchedule } from "../lib/scheduling";

// Shown for a student who isn't currently booked into a class — same picker as the
// enrolment form's "Preferred class" field, so a renewing student without a class
// (e.g. reactivated after a pause) can ask for one at the same time.
function PreferredClassField({ classes, classId, onChangeClassId, text, onChangeText }) {
  if (classes.length === 0) {
    return (
      <Field label="Preferred day/time (optional)">
        <input style={inputStyle} value={text} onChange={(e) => onChangeText(e.target.value)} placeholder="e.g. Saturday mornings, Tuesday evenings" />
      </Field>
    );
  }
  return (
    <Field label="Preferred class">
      <select style={inputStyle} value={classId} onChange={(e) => onChangeClassId(e.target.value)}>
        <option value="" disabled>Select a class…</option>
        {classes.map((c) => <option key={c.id} value={c.id}>{c.day} {formatTimeRange(c.time, c.end_time)}</option>)}
        <option value="none">No preference</option>
      </select>
      <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>We'll do our best to accommodate your preference, though the final class will be confirmed by the studio.</p>
    </Field>
  );
}

export default function RenewForm() {
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
  const [enrolledStudentIds, setEnrolledStudentIds] = useState(() => new Set()); // student ids that already have a current class
  const [preferredClassIds, setPreferredClassIds] = useState({}); // { [studentId]: classId | "none" }
  const [preferredClassTexts, setPreferredClassTexts] = useState({}); // { [studentId]: text } - used when there are no classes to pick from yet
  const [paymentClaimed, setPaymentClaimed] = useState(false);
  const [paymentFile, setPaymentFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmUnpaid, setConfirmUnpaid] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (!code) { setStudent(null); return; }
    const upperCode = code.trim().toUpperCase();

    supabase.from("package_tiers").select("*").eq("active", true).order("sort_order").then(({ data }) => setTiers(data || []));

    Promise.all([
      supabase.from("classes").select("id, label, day, time, end_time, capacity"),
      supabase.rpc("get_effective_class_counts"),
    ]).then(([cRes, eRes]) => {
      const counts = {};
      (eRes.data || []).forEach((row) => { counts[row.class_id] = Number(row.effective_count); });
      const open = (cRes.data || []).filter((c) => (counts[c.id] || 0) < c.capacity);
      setClasses(open.slice().sort(compareClassSchedule));
    });

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
      supabase.from("enrollments").select("student_id").in("student_id", allIds).then(({ data: enr }) => {
        setEnrolledStudentIds(new Set((enr || []).map((e) => e.student_id)));
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

  const needsPreferredClass = (studentId) => classes.length > 0 && !enrolledStudentIds.has(studentId);

  const handleSubmitClick = () => {
    if (!selectedTierId) { setError("Please select a package."); return; }
    const missingSibling = includedSiblingList.find((s) => !siblingTierIds[s.id]);
    if (missingSibling) { setError(`Please select a package for ${missingSibling.name}, or untick them.`); return; }
    if (needsPreferredClass(student.id) && !preferredClassIds[student.id]) {
      setError(`Please select a preferred class for ${student.name} — or choose "No preference" if any works.`);
      return;
    }
    const missingSiblingClass = includedSiblingList.find((s) => needsPreferredClass(s.id) && !preferredClassIds[s.id]);
    if (missingSiblingClass) { setError(`Please select a preferred class for ${missingSiblingClass.name} — or choose "No preference" if any works.`); return; }
    setError("");
    if (!paymentClaimed || !paymentFile) {
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
          params: { p_selections: selections, p_payment_claimed: paymentClaimed, p_payment_screenshot_path: screenshotPath },
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
      <div style={{ minHeight: "100vh", background: T.maroon, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", padding: 16 }}>
        <div style={{ background: T.ivory, borderRadius: 12, padding: "36px 28px", width: "100%", maxWidth: 360, textAlign: "center", boxSizing: "border-box" }}>
          <p style={{ color: T.terracotta, fontSize: 14 }}>This link isn't valid — check with the studio for a fresh one.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: T.maroon, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", padding: 16 }}>
        <div style={{ background: T.ivory, borderRadius: 12, padding: "40px 28px", width: "100%", maxWidth: 380, textAlign: "center", boxSizing: "border-box" }}>
          <img src={LOGO_DATA_URI} alt="" style={{ width: 60, height: 60, borderRadius: "50%", margin: "0 auto 16px", display: "block" }} />
          <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.maroonDark, marginBottom: 8 }}>Thank you!</h1>
          <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6 }}>We've received your renewal request. We'll confirm once it's processed.</p>
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
            <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: T.ivory }}>Renew package</h1>
            <p style={{ fontSize: 12, color: T.goldLight }}>Nritya Mandala</p>
          </div>
        </div>

        <div style={{ background: T.ivory, borderRadius: 12, padding: "24px 20px", boxSizing: "border-box", fontFamily: "Inter, sans-serif" }}>
          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 15, color: T.maroonDark, marginBottom: 6 }}>Is this correct?</h3>
          <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10 }}>Update the date of birth below if it isn't right.</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Field label="Student's name"><input style={inputStyle} value={student.name} disabled /></Field>
            <Field label="Date of birth"><input style={inputStyle} type="date" value={dobEdits[student.id] || ""} onChange={(e) => setDobEdits((m) => ({ ...m, [student.id]: e.target.value }))} /></Field>
          </div>

          {needsPreferredClass(student.id) && (
            <div style={{ marginBottom: 4 }}>
              <div style={{ background: `${T.gold}18`, border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12.5, color: T.ink, lineHeight: 1.5 }}>
                {student.name} isn't currently booked into a class — let us know a preference and we'll get them scheduled.
              </div>
              <PreferredClassField
                classes={classes}
                classId={preferredClassIds[student.id] || ""}
                onChangeClassId={(v) => setPreferredClassIds((m) => ({ ...m, [student.id]: v }))}
                text={preferredClassTexts[student.id] || ""}
                onChangeText={(v) => setPreferredClassTexts((m) => ({ ...m, [student.id]: v }))}
              />
            </div>
          )}

          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 4 }}>Select a package</h3>
          {tiers.length === 0 ? (
            <p style={{ fontSize: 13, color: T.inkSoft }}>No packages are available to select right now — please contact the studio directly.</p>
          ) : (
            <div className="grid gap-2 mb-4">
              {tiers.map((t) => (
                <label
                  key={t.id}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", border: `2px solid ${selectedTierId === t.id ? T.gold : T.line}`,
                    borderRadius: 8, padding: "12px 14px", cursor: "pointer", background: selectedTierId === t.id ? `${T.gold}12` : "#fff",
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

          {siblings.length > 0 && tiers.length > 0 && (
            <>
              <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 15, color: T.maroonDark, marginBottom: 8, marginTop: 4 }}>Renewing for another student too?</h3>
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
                      {needsPreferredClass(s.id) && (
                        <PreferredClassField
                          classes={classes}
                          classId={preferredClassIds[s.id] || ""}
                          onChangeClassId={(v) => setPreferredClassIds((m) => ({ ...m, [s.id]: v }))}
                          text={preferredClassTexts[s.id] || ""}
                          onChangeText={(v) => setPreferredClassTexts((m) => ({ ...m, [s.id]: v }))}
                        />
                      )}
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

          <div style={{ background: "#fff", border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "10px 16px", marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: T.maroonDark, fontWeight: 700, marginBottom: 4 }}>Bank Account Details</div>
            <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.6 }}>
              Bank: NAB<br />
              Account Name: Sarita Sigdel<br />
              BSB: 082 231<br />
              Account Number: 846746850
            </div>
          </div>

          <div style={{ background: `${T.gold}18`, border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "10px 16px", marginBottom: 14 }}>
            <p style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.5, marginBottom: referenceCodes ? 8 : 0 }}>
              Please pay using the bank details above, with the reference below. Once paid, tick the box and attach a screenshot so we can confirm it faster.
            </p>
            {referenceCodes && (
              <>
                <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 2 }}>Payment reference</div>
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, letterSpacing: 1, fontWeight: 700, color: T.maroonDark }}>{referenceCodes}</div>
              </>
            )}
          </div>

          <label className="flex items-center gap-2 mb-3" style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>
            <input type="checkbox" checked={paymentClaimed} onChange={(e) => { setPaymentClaimed(e.target.checked); if (!e.target.checked) setPaymentFile(null); }} />
            I have already paid
          </label>
          {paymentClaimed && (
            <Field label="Payment screenshot">
              <input type="file" accept="image/*,.pdf" onChange={(e) => setPaymentFile(e.target.files?.[0] || null)} style={{ fontSize: 13 }} />
            </Field>
          )}

          {error && <p style={{ color: T.terracotta, fontSize: 13, marginTop: 10 }}>{error}</p>}
          <TurnstileWidget onVerify={setTurnstileToken} />
          <div style={{ marginTop: 14 }}>
            <Btn variant="success" onClick={handleSubmitClick} size="lg" disabled={submitting || tiers.length === 0 || !turnstileToken}>{submitting ? "Submitting…" : "Submit request"}</Btn>
          </div>
        </div>
      </div>
      {confirmUnpaid && (
        <ConfirmModal
          title="Payment details incomplete"
          message={`You haven't ${!paymentClaimed && !paymentFile ? "specified your payment details or attached a screenshot" : !paymentClaimed ? "marked your payment as made" : "attached a payment screenshot"}. Payment has not been confirmed above. A delay in confirming payment may result in a delay in processing this renewal. If you'd like to submit anyway, we will reach out to you afterward regarding payment.`}
          confirmLabel="Submit anyway"
          onConfirm={submit}
          onCancel={() => setConfirmUnpaid(false)}
        />
      )}
    </div>
  );
}
