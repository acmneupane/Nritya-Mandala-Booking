import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { classesLabel } from "../lib/format";
import { Btn, Field, Modal, TypeToConfirmModal } from "./ui";

function TierModal({ initial, onClose, onSaved }) {
  const [name, setName] = useState(initial?.name || "");
  const [classesCount, setClassesCount] = useState(initial?.classes_count || 5);
  const [price, setPrice] = useState(initial?.price || "");
  const [siblingPrice, setSiblingPrice] = useState(initial?.sibling_price ?? "");
  const [siblingPriceLabel, setSiblingPriceLabel] = useState(initial?.sibling_price_label || "");
  const [active, setActive] = useState(initial ? initial.active : true);
  const [availableForEnrolment, setAvailableForEnrolment] = useState(initial ? initial.available_for_enrolment : true);
  const [availableForRenewal, setAvailableForRenewal] = useState(initial ? initial.available_for_renewal : true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!name.trim() || !classesCount || !price) { setError("Fill in name, classes, and price."); return; }
    setSaving(true);
    setError("");
    const payload = {
      name: name.trim(), classes_count: Number(classesCount), price: Number(price),
      sibling_price: siblingPrice === "" ? null : Number(siblingPrice),
      sibling_price_label: siblingPriceLabel.trim() || null,
      active,
      available_for_enrolment: availableForEnrolment,
      available_for_renewal: availableForRenewal,
    };
    const { error } = initial?.id
      ? await supabase.from("package_tiers").update(payload).eq("id", initial.id)
      : await supabase.from("package_tiers").insert(payload);
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSaved();
  };

  return (
    <Modal title={initial ? "Edit package" : "Add a package"} onClose={onClose}>
      <Field label="Name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 5-Class Package" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Number of classes"><input style={inputStyle} type="number" min={1} value={classesCount} onChange={(e) => setClassesCount(e.target.value)} /></Field>
        <Field label="Price ($)"><input style={inputStyle} type="number" step="0.01" min={0} value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
      </div>
      <Field label="Additional Student price ($, optional)">
        <input style={inputStyle} type="number" step="0.01" min={0} value={siblingPrice} onChange={(e) => setSiblingPrice(e.target.value)} placeholder="Leave blank to use the regular price" />
      </Field>
      {siblingPrice !== "" && (
        <Field label="Label for this price (optional)">
          <input style={inputStyle} value={siblingPriceLabel} onChange={(e) => setSiblingPriceLabel(e.target.value)} placeholder="Leave blank to show no extra label" />
        </Field>
      )}
      <label className="flex items-center gap-2 mb-3" style={{ fontSize: 13, color: T.ink }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active — this package can be offered at all
      </label>
      {active && (
        <div style={{ background: T.paper, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 6 }}>
            Where it can be selected — e.g. a 1-class trial package for new families that shouldn't be offered again at renewal.
          </p>
          <label className="flex items-center gap-2 mb-1" style={{ fontSize: 13, color: T.ink }}>
            <input type="checkbox" checked={availableForEnrolment} onChange={(e) => setAvailableForEnrolment(e.target.checked)} />
            Available when enrolling (new students)
          </label>
          <label className="flex items-center gap-2" style={{ fontSize: 13, color: T.ink }}>
            <input type="checkbox" checked={availableForRenewal} onChange={(e) => setAvailableForRenewal(e.target.checked)} />
            Available when renewing (existing students)
          </label>
        </div>
      )}
      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <div className="flex justify-end gap-2 mt-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="success" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save package"}</Btn>
      </div>
    </Modal>
  );
}

export default function PackageTiersView() {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("package_tiers").select("*").order("sort_order").order("classes_count");
    setTiers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (t) => {
    await supabase.from("package_tiers").update({ active: !t.active }).eq("id", t.id);
    load();
  };
  const doRemove = async (id) => {
    await supabase.from("package_tiers").delete().eq("id", id);
    setConfirmRemove(null);
    load();
  };

  if (loading) return <p style={{ color: T.inkSoft }}>Loading…</p>;

  return (
    <div>
      <div className="flex justify-end mb-4"><Btn onClick={() => setAdding(true)}>+ Add package</Btn></div>
      {tiers.length === 0 && <p style={{ color: T.inkSoft }}>No packages set up yet — add one so parents can select it on the renewal page.</p>}
      <div className="grid gap-4">
        {tiers.map((t) => (
          <div key={t.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderLeft: `5px solid ${t.active ? T.sage : T.inkSoft}`, borderRadius: 10, padding: 18, opacity: t.active ? 1 : 0.6 }} className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 18, color: T.maroonDark }}>{t.name}{!t.active && <span style={{ fontSize: 12, color: T.inkSoft, fontFamily: "Inter, sans-serif", marginLeft: 8 }}>(inactive)</span>}</div>
              <div style={{ fontSize: 13, color: T.inkSoft }}>
                {classesLabel(t.classes_count)} · ${Number(t.price).toFixed(2)}
                {t.sibling_price != null && (
                  <span> · Additional Student: ${Number(t.sibling_price).toFixed(2)}{t.sibling_price_label ? ` (${t.sibling_price_label})` : ""}</span>
                )}
              </div>
              {t.active && !(t.available_for_enrolment && t.available_for_renewal) && (
                <div style={{ fontSize: 11, fontWeight: 600, color: T.gold, marginTop: 3 }}>
                  {t.available_for_enrolment ? "Enrolment only" : t.available_for_renewal ? "Renewal only" : "Not offered on Enrol or Renew"}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => toggleActive(t)} style={{ fontSize: 13, fontWeight: 500, padding: "5px 12px", borderRadius: 999, border: `1px solid ${T.line}`, background: "#fff", color: T.inkSoft }}>
                {t.active ? "Deactivate" : "Activate"}
              </button>
              <button onClick={() => setEditing(t)} style={{ fontSize: 13, fontWeight: 500, padding: "5px 12px", borderRadius: 999, border: `1px solid ${T.maroon}55`, background: "#fff", color: T.maroon }}>Edit</button>
              <button onClick={() => setConfirmRemove(t)} style={{ fontSize: 13, fontWeight: 500, padding: "5px 12px", borderRadius: 999, border: `1px solid ${T.terracotta}55`, background: "#fff", color: T.terracotta }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      {(adding || editing) && (
        <TierModal initial={editing} onClose={() => { setAdding(false); setEditing(null); }} onSaved={() => { setAdding(false); setEditing(null); load(); }} />
      )}
      {confirmRemove && (
        <TypeToConfirmModal
          title="Delete this package?"
          message={`Removing "${confirmRemove.name}" won't affect renewal requests already submitted using it, but it will no longer be selectable. This can't be undone.`}
          confirmString={confirmRemove.name}
          confirmLabel="Delete"
          onConfirm={() => doRemove(confirmRemove.id)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}
