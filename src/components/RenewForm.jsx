import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { LOGO_DATA_URI } from "../lib/logo";
import { Btn, Field } from "./ui";

export default function RenewForm() {
  const code = new URLSearchParams(window.location.search).get("code") || "";
  const [student, setStudent] = useState(undefined); // undefined = loading, null = not found
  const [siblings, setSiblings] = useState([]); // other family members, from get_family_students
  const [tiers, setTiers] = useState([]);
  const [selectedTierId, setSelectedTierId] = useState(""); // primary student's tier
  const [includedSiblings, setIncludedSiblings] = useState({}); // { [siblingId]: true }
  const [siblingTierIds, setSiblingTierIds] = useState({}); // { [siblingId]: tierId }
  const [paymentClaimed, setPaymentClaimed] = useState(false);
  const [paymentFile, setPaymentFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (!code) { setStudent(null); return; }
    supabase.from("student_public").select("id, code, name").eq("code", code.trim().toUpperCase()).maybeSingle()
      .then(({ data }) => setStudent(data || null));
    supabase.from("package_tiers").select("*").eq("active", true).order("sort_order").then(({ data }) => setTiers(data || []));
    supabase.rpc("get_family_students", { p_code: code.trim().toUpperCase() }).then(({ data }) => {
      setSiblings((data || []).filter((s) => s.code.toUpperCase() !== code.trim().toUpperCase()));
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

  const submit = async () => {
    if (!selectedTierId) { setError("Please select a package."); return; }
    const missingSibling = includedSiblingList.find((s) => !siblingTierIds[s.id]);
    if (missingSibling) { setError(`Please select a package for ${missingSibling.name}, or untick them.`); return; }

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

      const selections = [
        { code: student.code, tier_id: selectedTierId },
        ...includedSiblingList.map((s) => ({ code: s.code, tier_id: siblingTierIds[s.id] })),
      ];

      const { error: rpcErr } = await supabase.rpc("submit_family_renewal", {
        p_selections: selections, p_payment_claimed: paymentClaimed, p_payment_screenshot_path: screenshotPath,
      });
      if (rpcErr) throw rpcErr;
      setDone(true);
    } catch (e) {
      setError(e.message && e.message.startsWith("Couldn't upload") ? e.message : "Something went wrong submitting — please try again.");
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
          <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 4 }}>{student.name}</h3>
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
                      <div style={{ fontSize: 12, color: T.inkSoft }}>{t.classes_count} classes</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.maroonDark }}>${Number(t.price).toFixed(2)}</div>
                </label>
              ))}
            </div>
          )}

          {siblings.length > 0 && tiers.length > 0 && (
            <>
              <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 15, color: T.maroonDark, marginBottom: 8, marginTop: 4 }}>Renewing for a sibling too?</h3>
              {siblings.map((s) => (
                <div key={s.id} style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <label className="flex items-center gap-2 mb-2" style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>
                    <input type="checkbox" checked={!!includedSiblings[s.id]} onChange={(e) => toggleSibling(s.id, e.target.checked)} />
                    Also renew for {s.name}
                  </label>
                  {includedSiblings[s.id] && (
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
                              <span style={{ fontSize: 13, color: T.ink }}>{t.name} ({t.classes_count} classes){t.sibling_price != null ? " — sibling price" : ""}</span>
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 700, color: T.maroonDark }}>${p.toFixed(2)}</span>
                          </label>
                        );
                      })}
                    </div>
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

          <div style={{ background: `${T.gold}18`, border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "10px 16px", marginBottom: 14 }}>
            <p style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.5, marginBottom: referenceCodes ? 8 : 0 }}>
              Please pay using the studio's bank details (sent in your reminder email), with the reference below. Once paid, tick the box and attach a screenshot so we can confirm it faster.
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
          <div style={{ marginTop: 14 }}>
            <Btn variant="success" onClick={submit} size="lg" disabled={submitting || tiers.length === 0}>{submitting ? "Submitting…" : "Submit request"}</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
