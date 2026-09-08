import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Field, Modal, TypeToConfirmModal } from "./ui";
import { localDateStr } from "../lib/dates";

function AddLevelModal({ nextOrder, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from("levels").insert({ name: name.trim(), description: desc.trim(), order_num: nextOrder });
    setSaving(false);
    onSaved();
  };

  return (
    <Modal title="Add a level" onClose={onClose}>
      <Field label="Level name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Paila" autoFocus /></Field>
      <Field label="What this level means"><textarea style={{ ...inputStyle, minHeight: 70 }} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Basic sequences and hand gestures (mudras)" /></Field>
      <p style={{ fontSize: 11, color: T.inkSoft, marginBottom: 16 }}>It'll be added to the end of the order — reorder with the up/down arrows afterwards if needed.</p>
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? "Adding…" : "Add level"}</Btn>
      </div>
    </Modal>
  );
}

export default function LevelsView() {
  const [levels, setLevels] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingLevel, setAddingLevel] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [lRes, sRes] = await Promise.all([
      supabase.from("levels").select("*").order("order_num"),
      supabase.from("students").select("id, name, level_id").eq("archived", false).order("name"),
    ]);
    setLevels(lRes.data || []);
    setStudents(sRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Local edits are applied immediately for responsiveness, then persisted.
  const updateLevelField = (id, field, val) => {
    setLevels((ls) => ls.map((l) => (l.id === id ? { ...l, [field]: val } : l)));
  };
  const persistLevelField = async (id, field, val) => {
    const column = field === "desc" ? "description" : field;
    await supabase.from("levels").update({ [column]: val }).eq("id", id);
  };

  const moveLevel = async (id, dir) => {
    const idx = levels.findIndex((l) => l.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= levels.length) return;
    const a = levels[idx], b = levels[swapIdx];
    setLevels((ls) => ls.map((l) => (l.id === a.id ? { ...l, order_num: b.order_num } : l.id === b.id ? { ...l, order_num: a.order_num } : l)).sort((x, y) => x.order_num - y.order_num));
    await supabase.from("levels").update({ order_num: b.order_num }).eq("id", a.id);
    await supabase.from("levels").update({ order_num: a.order_num }).eq("id", b.id);
  };

  // Levels are deliberately not individually deletable — deleting one out from under
  // students who've already progressed through it would erase their history. "Reset"
  // below is the one deliberate way to clear the whole list and start over.
  const doResetLevels = async () => {
    await supabase.from("students").update({ level_id: null }).not("level_id", "is", null);
    await supabase.from("level_history").delete().not("id", "is", null);
    await supabase.from("levels").delete().not("id", "is", null);
    setConfirmReset(false);
    load();
  };

  const promote = async (studentId, levelId) => {
    await supabase.from("students").update({ level_id: levelId || null }).eq("id", studentId);
    if (levelId) {
      await supabase.from("level_history").insert({ student_id: studentId, level_id: levelId, date: localDateStr(new Date()) });
    }
    load();
  };

  if (loading) return <p style={{ color: T.inkSoft }}>Loading…</p>;

  return (
    <div>
      <div className="flex justify-end gap-2 mb-4">
        <Btn variant="danger" onClick={() => setConfirmReset(true)}>Reset levels</Btn>
        <Btn onClick={() => setAddingLevel(true)}>+ Add level</Btn>
      </div>
      {levels.length === 0 && <p style={{ color: T.inkSoft, marginBottom: 16 }}>No levels defined yet. Add your first one — use the up/down arrows to set the order students progress through.</p>}
      <div className="grid gap-4 mb-8">
        {levels.map((l, i) => (
          <div key={l.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderLeft: `5px solid ${T.sage}`, borderRadius: 10, padding: 18 }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex flex-col" style={{ gap: 2 }}>
                <button onClick={() => moveLevel(l.id, -1)} disabled={i === 0} style={{ color: i === 0 ? `${T.inkSoft}55` : T.maroon, lineHeight: 0.7, fontSize: 15 }} title="Move up">▲</button>
                <button onClick={() => moveLevel(l.id, 1)} disabled={i === levels.length - 1} style={{ color: i === levels.length - 1 ? `${T.inkSoft}55` : T.maroon, lineHeight: 0.7, fontSize: 15 }} title="Move down">▼</button>
              </div>
              <span style={{ fontSize: 14, color: T.inkSoft, width: 22 }}>{i + 1}.</span>
              <input
                style={{ ...inputStyle, fontFamily: "Fraunces, serif", fontSize: 19, fontWeight: 600, border: "none", padding: "2px 0", width: "auto", flex: 1 }}
                value={l.name}
                onChange={(e) => updateLevelField(l.id, "name", e.target.value)}
                onBlur={(e) => persistLevelField(l.id, "name", e.target.value)}
              />
            </div>
            <input
              style={{ ...inputStyle, fontSize: 13.5, border: "none", padding: "2px 0", color: T.inkSoft, marginLeft: 34 }}
              value={l.description || ""}
              onChange={(e) => updateLevelField(l.id, "description", e.target.value)}
              onBlur={(e) => persistLevelField(l.id, "description", e.target.value)}
              placeholder="What this level means…"
            />
            <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 8, marginLeft: 34 }}>{students.filter((s) => s.level_id === l.id).length} students at this level</div>
          </div>
        ))}
      </div>

      {levels.length > 0 && (
        <>
          <h4 style={{ fontFamily: "Fraunces, serif", color: T.maroonDark, fontSize: 18, marginBottom: 12 }}>Update a student's level</h4>
          <div className="grid gap-3">
            {students.map((s) => {
              const current = levels.find((l) => l.id === s.level_id);
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${T.line}`, borderRadius: 8, padding: "12px 14px", background: "#fff" }} className="flex-wrap gap-2">
                  <div>
                    <span style={{ fontSize: 15, fontWeight: 500 }}>{s.name}</span>
                    <span style={{ fontSize: 13, color: T.inkSoft, marginLeft: 10 }}>{current ? current.name : "Unassigned"}</span>
                  </div>
                  <select style={{ ...inputStyle, width: 190 }} value={s.level_id || ""} onChange={(e) => promote(s.id, e.target.value)}>
                    <option value="">Unassigned</option>
                    {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        </>
      )}

      {addingLevel && <AddLevelModal nextOrder={levels.length + 1} onClose={() => setAddingLevel(false)} onSaved={() => { setAddingLevel(false); load(); }} />}
      {confirmReset && (
        <TypeToConfirmModal
          title="Reset all levels?"
          message="This clears every level and unassigns every student's level. Their attendance and packages are kept."
          confirmString="RESET"
          confirmLabel="Reset levels"
          onConfirm={doResetLevels}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}
