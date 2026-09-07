import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Field, Modal, ConfirmModal } from "./ui";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function LevelBadge({ level }) {
  if (!level) return <span style={{ fontSize: 12, color: T.inkSoft }}>Any level</span>;
  return <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, background: `${T.sage}22`, color: T.sage, fontWeight: 600 }}>{level.name}</span>;
}

function ClassModal({ initial, levels, onSave, onClose }) {
  const [label, setLabel] = useState(initial?.label || "");
  const [day, setDay] = useState(initial?.day || "Saturday");
  const [time, setTime] = useState(initial?.time || "10:00");
  const [levelId, setLevelId] = useState(initial?.level_id || "");
  const [capacity, setCapacity] = useState(initial?.capacity || 12);
  const [startDate, setStartDate] = useState(initial?.start_date || "");
  const [endDate, setEndDate] = useState(initial?.end_date || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!label.trim()) return;
    if (startDate && endDate && endDate < startDate) {
      setError("End date can't be before the start date.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      label: label.trim(), day, time, level_id: levelId || null, capacity: Number(capacity) || 12,
      start_date: startDate || null, end_date: endDate || null,
    };
    if (initial?.id) {
      await supabase.from("classes").update(payload).eq("id", initial.id);
    } else {
      await supabase.from("classes").insert(payload);
    }
    setSaving(false);
    onSave();
  };

  return (
    <Modal title={initial ? "Edit class" : "Add a class"} onClose={onClose}>
      <Field label="Class name"><input style={inputStyle} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Beginners Saturday" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Day">
          <select style={inputStyle} value={day} onChange={(e) => setDay(e.target.value)}>
            {DAYS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Time"><input style={inputStyle} type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Level focus">
          <select style={inputStyle} value={levelId} onChange={(e) => setLevelId(e.target.value)}>
            <option value="">Any level</option>
            {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
        <Field label="Capacity"><input style={inputStyle} type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Term starts"><input style={inputStyle} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
        <Field label="Term ends"><input style={inputStyle} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
      </div>
      <p style={{ fontSize: 11, color: T.inkSoft, marginBottom: 12 }}>Leave either blank for open-ended. The class only appears on the Calendar within this range — nothing to add in the past or too far ahead.</p>
      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save class"}</Btn>
      </div>
    </Modal>
  );
}

export default function ClassesView() {
  const [classes, setClasses] = useState([]);
  const [levels, setLevels] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [cRes, lRes, eRes] = await Promise.all([
      supabase.from("classes").select("*"),
      supabase.from("levels").select("*").order("order_num"),
      supabase.from("enrollments").select("class_id"),
    ]);
    setClasses(cRes.data || []);
    setLevels(lRes.data || []);
    setEnrollments(eRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const levelById = useMemo(() => Object.fromEntries(levels.map((l) => [l.id, l])), [levels]);
  const byDay = DAYS.map((day) => ({
    day,
    items: classes.filter((c) => c.day === day).sort((a, b) => a.time.localeCompare(b.time)),
  }));

  const doRemove = async (id) => {
    await supabase.from("classes").delete().eq("id", id);
    setConfirmRemove(null);
    load();
  };

  if (loading) return <p style={{ color: T.inkSoft }}>Loading…</p>;

  return (
    <div>
      <div className="flex justify-end mb-4"><Btn onClick={() => setAdding(true)}>+ Add class</Btn></div>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {byDay.filter((d) => d.items.length).map(({ day, items }) => (
          <div key={day}>
            <h4 style={{ fontFamily: "Fraunces, serif", color: T.maroonDark, fontSize: 15, marginBottom: 6 }}>{day}</h4>
            {items.map((c) => {
              const enrolled = enrollments.filter((e) => e.class_id === c.id).length;
              return (
                <div key={c.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: T.ink }}>{c.label}</div>
                      <div style={{ fontSize: 12, color: T.inkSoft }}>{c.time} · {enrolled}/{c.capacity} enrolled</div>
                      <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
                        {c.start_date || c.end_date
                          ? `${c.start_date ? c.start_date : "No start"} → ${c.end_date ? c.end_date : "Ongoing"}`
                          : "No date range set — always shows on the calendar"}
                      </div>
                      {levelById[c.level_id] && <div style={{ marginTop: 4 }}><LevelBadge level={levelById[c.level_id]} /></div>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(c)} style={{ color: T.maroon, fontSize: 12 }}>Edit</button>
                      <button onClick={() => setConfirmRemove(c)} style={{ color: T.terracotta, fontSize: 12 }}>Remove</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {classes.length === 0 && <p style={{ color: T.inkSoft }}>No classes set up yet.</p>}
      </div>
      {(adding || editing) && (
        <ClassModal
          initial={editing}
          levels={levels}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSave={() => { setAdding(false); setEditing(null); load(); }}
        />
      )}
      {confirmRemove && (
        <ConfirmModal
          message="Remove this class? Bookings and attendance for it will also be removed."
          onConfirm={() => doRemove(confirmRemove.id)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}
