import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Field, Modal, ConfirmModal } from "./ui";
import QrModal from "./QrCode";

function genCode(existing) {
  const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (existing.includes(code));
  return code;
}

function LevelBadge({ level }) {
  if (!level) return <span style={{ fontSize: 12, color: T.inkSoft }}>Unassigned</span>;
  return (
    <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, background: `${T.sage}22`, color: T.sage, fontWeight: 600 }}>{level.name}</span>
  );
}

function StudentModal({ initial, levels, allGuardians, onClose, onSaved }) {
  const [name, setName] = useState(initial?.name || "");
  const [age, setAge] = useState(initial?.age || "");
  const [levelId, setLevelId] = useState(initial?.level_id || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [links, setLinks] = useState([]); // {guardian_id, name, phone, relation, emergency}
  const [guardianQuery, setGuardianQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!initial?.id) return;
    supabase
      .from("student_guardians")
      .select("id, guardian_id, relation, emergency, guardians(id, name, phone)")
      .eq("student_id", initial.id)
      .then(({ data }) => {
        setLinks((data || []).map((l) => ({
          linkId: l.id,
          guardianId: l.guardian_id,
          name: l.guardians?.name || "",
          phone: l.guardians?.phone || "",
          relation: l.relation,
          emergency: l.emergency,
        })));
      });
  }, [initial?.id]);

  const addNewGuardian = () => {
    setLinks((ls) => [...ls, { linkId: null, guardianId: null, name: "", phone: "", relation: "Parent", emergency: ls.length === 0, isNew: true }]);
  };
  const linkExistingGuardian = (g) => {
    if (links.some((l) => l.guardianId === g.id)) return;
    setLinks((ls) => [...ls, { linkId: null, guardianId: g.id, name: g.name, phone: g.phone, relation: "Parent", emergency: ls.length === 0, isExisting: true }]);
    setGuardianQuery("");
  };
  const updateLink = (i, field, val) => setLinks((ls) => ls.map((l, idx) => (idx === i ? { ...l, [field]: val } : l)));
  const removeLink = (i) => setLinks((ls) => ls.filter((_, idx) => idx !== i));

  const matches = guardianQuery.trim()
    ? allGuardians.filter((g) => g.name.toLowerCase().includes(guardianQuery.toLowerCase()) && !links.some((l) => l.guardianId === g.id))
    : [];

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      let studentId = initial?.id;
      if (studentId) {
        const { error } = await supabase.from("students").update({
          name: name.trim(), age: age ? Number(age) : null, level_id: levelId || null, notes: notes.trim(),
        }).eq("id", studentId);
        if (error) throw error;
      } else {
        const { data: existingCodes } = await supabase.from("students").select("code");
        const code = genCode((existingCodes || []).map((r) => r.code));
        const { data, error } = await supabase.from("students").insert({
          name: name.trim(), age: age ? Number(age) : null, level_id: levelId || null, notes: notes.trim(), code,
        }).select().single();
        if (error) throw error;
        studentId = data.id;
      }

      // Sync guardian links: create new guardian people as needed, upsert the relationship rows.
      for (const l of links) {
        let guardianId = l.guardianId;
        if (!guardianId && l.name.trim()) {
          const { data, error } = await supabase.from("guardians").insert({ name: l.name.trim(), phone: l.phone.trim() }).select().single();
          if (error) throw error;
          guardianId = data.id;
        } else if (guardianId && l.isExisting) {
          // existing guardian selected from search — no edits needed to the person record here
        }
        if (!guardianId) continue;
        if (l.linkId) {
          await supabase.from("student_guardians").update({ relation: l.relation, emergency: l.emergency }).eq("id", l.linkId);
        } else {
          await supabase.from("student_guardians").insert({ student_id: studentId, guardian_id: guardianId, relation: l.relation, emergency: l.emergency });
        }
      }

      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? "Edit student" : "Add a student"} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Student's name" /></Field>
        <Field label="Age"><input style={inputStyle} type="number" min={4} value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 7" /></Field>
      </div>
      <Field label="Level">
        <select style={inputStyle} value={levelId} onChange={(e) => setLevelId(e.target.value)}>
          <option value="">Unassigned</option>
          {[...levels].sort((a, b) => a.order_num - b.order_num).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </Field>
      <Field label="Notes (allergies, needs, etc.)"><textarea style={{ ...inputStyle, minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>

      <div className="mt-2 mb-1">
        <span className="text-xs font-medium block mb-2" style={{ color: T.inkSoft }}>Parent / emergency contacts</span>
        <div className="flex gap-2 mb-2 relative">
          <input style={inputStyle} placeholder="Search existing guardians by name…" value={guardianQuery} onChange={(e) => setGuardianQuery(e.target.value)} />
          <Btn size="sm" onClick={addNewGuardian}>+ New</Btn>
          {matches.length > 0 && (
            <div style={{ position: "absolute", top: 38, left: 0, right: 90, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, zIndex: 5, maxHeight: 140, overflowY: "auto" }}>
              {matches.map((g) => (
                <button key={g.id} onClick={() => linkExistingGuardian(g)} style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", fontSize: 13 }}>
                  {g.name} <span style={{ color: T.inkSoft, fontSize: 11 }}>· {g.phone}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {links.map((l, i) => (
        <div key={i} style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input style={inputStyle} placeholder="Name" value={l.name} disabled={!!l.isExisting} onChange={(e) => updateLink(i, "name", e.target.value)} />
            <input style={inputStyle} placeholder="Phone" value={l.phone} disabled={!!l.isExisting} onChange={(e) => updateLink(i, "phone", e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <select style={{ ...inputStyle, width: 140 }} value={l.relation} onChange={(e) => updateLink(i, "relation", e.target.value)}>
              {["Parent", "Guardian", "Grandparent", "Relative", "Other"].map((r) => <option key={r}>{r}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-xs" style={{ color: T.inkSoft }}>
              <input type="checkbox" checked={l.emergency} onChange={(e) => updateLink(i, "emergency", e.target.checked)} /> Emergency contact
            </label>
            <button onClick={() => removeLink(i)} style={{ color: T.terracotta, marginLeft: "auto" }}>✕</button>
          </div>
          {l.isExisting && <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>Existing guardian — also linked to other students. Edit their name/phone from any of their students.</p>}
        </div>
      ))}

      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : initial ? "Save changes" : "Save student"}</Btn>
      </div>
    </Modal>
  );
}

export default function StudentsView() {
  const [students, setStudents] = useState([]);
  const [levels, setLevels] = useState([]);
  const [guardians, setGuardians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [showingQr, setShowingQr] = useState(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, lRes, gRes] = await Promise.all([
      supabase.from("students").select("*").order("name"),
      supabase.from("levels").select("*"),
      supabase.from("guardians").select("*").order("name"),
    ]);
    setStudents(sRes.data || []);
    setLevels(lRes.data || []);
    setGuardians(gRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const levelById = Object.fromEntries(levels.map((l) => [l.id, l]));
  const filtered = students.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  const doRemove = async (id) => {
    await supabase.from("students").delete().eq("id", id);
    setConfirmRemove(null);
    load();
  };

  if (loading) return <p style={{ color: T.inkSoft }}>Loading…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <input style={{ ...inputStyle, width: 240 }} placeholder="Search students…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Btn onClick={() => setAdding(true)}>+ Add student</Btn>
      </div>
      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", color: T.inkSoft }}>
          <p>No students yet. Add the first one to get started.</p>
        </div>
      )}
      <div className="grid gap-3">
        {filtered.map((s) => (
          <div key={s.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${T.gold}`, borderRadius: 8, padding: 14 }} className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark }}>{s.name}</span>
                {s.age && <span style={{ fontSize: 12, color: T.inkSoft }}>· {s.age}y</span>}
                <span style={{ fontSize: 11, color: T.gold, fontWeight: 700, letterSpacing: 1 }}>· {s.code}</span>
              </div>
              <LevelBadge level={levelById[s.level_id]} />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowingQr(s)} style={{ color: T.gold }}>QR code</button>
              <button onClick={() => setEditing(s)} style={{ color: T.maroon }}>Edit</button>
              <button onClick={() => setConfirmRemove(s)} style={{ color: T.terracotta }}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      {(adding || editing) && (
        <StudentModal
          initial={editing}
          levels={levels}
          allGuardians={guardians}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); load(); }}
        />
      )}
      {showingQr && <QrModal student={showingQr} onClose={() => setShowingQr(null)} />}
      {confirmRemove && (
        <ConfirmModal
          message={`Remove ${confirmRemove.name} and all their records — bookings, attendance, level history? This can't be undone.`}
          onConfirm={() => doRemove(confirmRemove.id)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}
