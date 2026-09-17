import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { classesLabel } from "../lib/format";
import { Btn, Field } from "./ui";

// A local (not-yet-saved) list of packages to create once a student exists — used
// both when adding a brand-new student and when approving an enrolment (where the
// student doesn't have an id yet either). The caller is responsible for actually
// inserting these into the packages table once the student row is created.
//
// tierName (which package this is, e.g. "Paanch Kadam") is kept separate from note
// (an internal admin-only remark) — the former is safe to show a parent later, the
// latter never should be.
//
// "Add package" / "Save changes" here deliberately use the plain action colour, not
// the submit colour — they only update this in-memory list, not the database. The
// real save happens later when the student itself is saved/approved. onDirtyChange
// lets the parent know when there's an open, unsaved package form, so it can warn
// before letting that outer save proceed and silently lose it.
export default function PendingPackagesEditor({ pendingPackages, setPendingPackages, onDirtyChange, showPayment = true }) {
  const [adding, setAdding] = useState(pendingPackages.length === 0);
  const [editingIndex, setEditingIndex] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [selectedTierId, setSelectedTierId] = useState("");
  const [classesTotal, setClassesTotal] = useState(10);
  const [amount, setAmount] = useState("");
  const [tierName, setTierName] = useState("");
  const [note, setNote] = useState("");
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");

  useEffect(() => {
    supabase.from("package_tiers").select("*").eq("active", true).order("sort_order").then(({ data }) => setTiers(data || []));
  }, []);

  useEffect(() => {
    onDirtyChange && onDirtyChange(adding || editingIndex !== null);
  }, [adding, editingIndex, onDirtyChange]);

  const resetForm = () => { setSelectedTierId(""); setClassesTotal(10); setAmount(""); setTierName(""); setNote(""); setPaymentConfirmed(false); setPaymentMethod(""); };

  const applyTier = (tierId) => {
    setSelectedTierId(tierId);
    const tier = tiers.find((t) => t.id === tierId);
    if (tier) { setClassesTotal(tier.classes_count); setAmount(String(tier.price)); setTierName(tier.name); }
  };

  const addPackage = () => {
    if (!classesTotal || Number(classesTotal) <= 0) return;
    setPendingPackages((ps) => [...ps, {
      classesTotal: Number(classesTotal), amount: amount ? Number(amount) : null, tierName: tierName.trim() || null, note: note.trim(),
      paymentConfirmed, paymentMethod: paymentConfirmed ? (paymentMethod || null) : null,
    }]);
    setAdding(false);
    resetForm();
  };
  const removePackage = (i) => setPendingPackages((ps) => ps.filter((_, idx) => idx !== i));

  const startEdit = (i, p) => {
    setEditingIndex(i);
    setSelectedTierId("");
    setClassesTotal(p.classesTotal);
    setAmount(p.amount != null ? String(p.amount) : "");
    setTierName(p.tierName || "");
    setNote(p.note || "");
    setPaymentConfirmed(p.paymentConfirmed || false);
    setPaymentMethod(p.paymentMethod || "");
  };
  const saveEdit = () => {
    if (!classesTotal || Number(classesTotal) <= 0) return;
    setPendingPackages((ps) => ps.map((p, idx) => (idx === editingIndex ? {
      ...p, classesTotal: Number(classesTotal), amount: amount ? Number(amount) : null, tierName: tierName.trim() || null, note: note.trim(),
      paymentConfirmed, paymentMethod: paymentConfirmed ? (paymentMethod || null) : null,
    } : p)));
    setEditingIndex(null);
    resetForm();
  };

  const tierPicker = tiers.length > 0 && (
    <Field label="Package (optional — or enter custom below)">
      <select style={inputStyle} value={selectedTierId} onChange={(e) => applyTier(e.target.value)}>
        <option value="">Custom…</option>
        {tiers.map((t) => <option key={t.id} value={t.id}>{t.name} — {classesLabel(t.classes_count)} — ${Number(t.price).toFixed(2)}</option>)}
      </select>
    </Field>
  );

  const paymentFields = showPayment && (
    <>
      <label className="flex items-center gap-2 mb-2" style={{ fontSize: 12, color: T.ink, fontWeight: 500 }}>
        <input type="checkbox" checked={paymentConfirmed} onChange={(e) => setPaymentConfirmed(e.target.checked)} /> Payment confirmed
      </label>
      {paymentConfirmed && (
        <Field label="Payment method">
          <select style={inputStyle} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="">Not specified</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>
        </Field>
      )}
    </>
  );

  return (
    <div className="mt-2 mb-1">
      <span className="text-xs font-medium block mb-2" style={{ color: T.inkSoft }}>Starting package (optional)</span>
      {pendingPackages.map((p, i) => (
        editingIndex === i ? (
          <div key={i} style={{ border: `1px solid ${T.gold}`, borderRadius: 8, padding: 10, marginBottom: 6 }}>
            {tierPicker}
            <Field label="Package name (shown to parents)"><input style={inputStyle} value={tierName} onChange={(e) => setTierName(e.target.value)} placeholder="e.g. पाँच कदम" /></Field>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Field label="Classes bought"><input style={inputStyle} type="number" min={1} value={classesTotal} onChange={(e) => setClassesTotal(e.target.value)} /></Field>
              <Field label="Amount paid ($)"><input style={inputStyle} type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            </div>
            <Field label="Internal notes (admin only, not shown to parents)"><input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            {paymentFields}
            <div className="flex justify-end gap-2 mt-1">
              <Btn variant="ghost" size="sm" onClick={() => { setEditingIndex(null); resetForm(); }}>Cancel</Btn>
              <Btn size="sm" onClick={saveEdit}>Save changes</Btn>
            </div>
          </div>
        ) : (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${T.line}`, borderRadius: 6, padding: "6px 10px", marginBottom: 6, fontSize: 12 }}>
            <div>
              <span style={{ fontWeight: 600 }}>{p.tierName ? `${p.tierName} — ` : ""}{classesLabel(p.classesTotal)}</span>
              {p.amount != null && <span style={{ color: T.inkSoft, marginLeft: 6 }}>· ${Number(p.amount).toFixed(2)}</span>}
              {showPayment && <span style={{ marginLeft: 6, color: p.paymentConfirmed ? T.sage : T.terracotta, fontWeight: 600 }}>· {p.paymentConfirmed ? "Confirmed" : "Unconfirmed"}</span>}
              {p.note && <div style={{ color: T.inkSoft, marginTop: 2 }}><em>Internal note:</em> {p.note}</div>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => startEdit(i, p)} style={{ color: T.maroon }}>Edit</button>
              <button onClick={() => removePackage(i)} style={{ color: T.terracotta }}>✕</button>
            </div>
          </div>
        )
      ))}
      {adding ? (
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 10 }}>
          {tierPicker}
          <Field label="Package name (shown to parents)"><input style={inputStyle} value={tierName} onChange={(e) => setTierName(e.target.value)} placeholder="e.g. पाँच कदम" /></Field>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Field label="Classes bought"><input style={inputStyle} type="number" min={1} value={classesTotal} onChange={(e) => setClassesTotal(e.target.value)} /></Field>
            <Field label="Amount paid ($)"><input style={inputStyle} type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 90.00" /></Field>
          </div>
          <Field label="Internal notes (admin only, not shown to parents)"><input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. paid in two instalments" /></Field>
          {paymentFields}
          <div className="flex justify-end gap-2 mt-1">
            {pendingPackages.length > 0 && <Btn variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Btn>}
            <Btn size="sm" onClick={addPackage}>Add package</Btn>
          </div>
        </div>
      ) : (
        <Btn size="sm" variant="ghost" onClick={() => setAdding(true)}>+ Add another package</Btn>
      )}
      <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>You can always add more packages later as they buy them — this is just to record what they've already paid, if anything.</p>
    </div>
  );
}
