import { useState } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { Btn, Modal } from "./ui";
import { upcomingOccurrencesOf, formatTimeRange } from "../lib/scheduling";
import { localDateStr } from "../lib/dates";

// Lets a parent mark several upcoming weekly classes as absences in one go — e.g.
// "we're away for the next 5 Wednesdays" — instead of one date at a time. Requires a
// reason as a deliberate friction step so it can't be triggered by an accidental tap.
export default function MarkAbsentModal({ student, classes, skips, onClose, onDone }) {
  // Flatten every enrolled class's next several occurrences into one selectable list.
  const options = classes.flatMap((c) =>
    upcomingOccurrencesOf(c, skips, localDateStr, { count: 10 }).map((occ) => ({
      classId: c.id, day: c.day, time: c.time, endTime: c.end_time, date: occ.date, dateStr: occ.dateStr,
      key: `${c.id}-${occ.dateStr}`,
    }))
  ).sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  const [selected, setSelected] = useState(new Set());
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggle = (key) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const confirm = async () => {
    if (selected.size === 0) { setError("Select at least one class."); return; }
    if (!reason.trim()) { setError("Please add a short reason — this helps confirm it wasn't an accidental tap."); return; }
    setSaving(true);
    setError("");
    const chosen = options.filter((o) => selected.has(o.key));
    let anyFailed = false;
    for (const o of chosen) {
      const { data: ok } = await supabase.rpc("mark_absence", { p_code: student.code, p_class_id: o.classId, p_date: o.dateStr, p_reason: reason.trim() });
      if (!ok) anyFailed = true;
    }
    setSaving(false);
    if (anyFailed) {
      setError("Some dates couldn't be marked — the studio may have already recorded attendance for one of them.");
    }
    onDone();
  };

  return (
    <Modal title="Mark upcoming classes as absent" onClose={onClose} wide>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 12, lineHeight: 1.5 }}>
        Select every class {student.name} will miss, add a reason, and confirm.
      </p>
      {options.length === 0 ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>No upcoming classes found.</p>
      ) : (
        <div className="grid gap-2 mb-4" style={{ maxHeight: 260, overflowY: "auto" }}>
          {options.map((o) => (
            <label key={o.key} className="flex items-center gap-2" style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={selected.has(o.key)} onChange={() => toggle(o.key)} />
              <span>{o.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {formatTimeRange(o.time, o.endTime)}</span>
            </label>
          ))}
        </div>
      )}
      <label className="block mb-3">
        <span className="block text-xs font-medium mb-1" style={{ color: T.inkSoft }}>Reason (required)</span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Family trip, will be away those weeks"
          style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontSize: 14, fontFamily: "Inter, sans-serif" }}
        />
      </label>
      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" onClick={confirm} disabled={saving || selected.size === 0}>
          {saving ? "Marking…" : `Mark absent for ${selected.size || ""} class${selected.size === 1 ? "" : "es"}`}
        </Btn>
      </div>
    </Modal>
  );
}
