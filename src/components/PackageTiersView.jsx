import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Field, Modal, TypeToConfirmModal } from "./ui";

function TierModal({ initial, onClose, onSaved }) {
  const [name, setName] = useState(initial?.name || "");
  const [classesCount, setClassesCount] = useState(initial?.classes_count || 5);
  const [price, setPrice] = useState(initial?.price || "");
  const [active, setActive] = useState(initial ? initial.active : true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!name.trim() || !classesCount || !price) { setError("Fill in name, classes, and price."); return; }
    setSaving(true);
    setError("");
    const payload = { name: name.trim(), classes_count: Number(classesCount), price: Number(price), active };
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
      <label className="flex items-center gap-2 mb-3" style={{ fontSize: 13, color: T.ink }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active — visible to parents on the renewal page
      </label>
      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <div className="flex justify-end gap-2 mt-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save package"}</Btn>
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
              <div style={{ fontSize: 13, color: T.inkSoft }}>{t.classes_count} classes · ${Number(t.price).toFixed(2)}</div>
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
