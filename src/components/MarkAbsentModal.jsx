import { useState } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { Btn, Modal } from "./ui";
import { upcomingOccurrencesOf, formatTimeRange } from "../lib/scheduling";
import { localDateStr } from "../lib/dates";

// Lets a parent mark several upcoming weekly classes as absences in one go — e.g.
// "we're away for the next 5 Wednesdays" — instead of one date at a time. Requires a
// reason as a deliberate friction step so it can't be triggered by an accidental tap.
// The list is capped to their remaining package balance (not an arbitrary lookahead) —
// no point offering to mark absent for classes they haven't paid for — and, since
// upcomingOccurrencesOf already filters out anything the studio has skipped, it never
// shows a date the admin has cancelled.
export default function MarkAbsentModal({ student, classes, skips, remaining, lockTo, onClose, onDone }) {
  const cap = typeof remaining === "number" && remaining > 0 ? remaining : 8;
  // Pull a generous pool per class, merge everything chronologically, then keep only
  // as many as the student actually has left on their package. If lockTo is given
  // (marking just the next class from the banner), skip all that and use it alone.
  const options = lockTo
    ? [{ classId: lockTo.classId, day: lockTo.day, time: lockTo.time, endTime: lockTo.endTime, date: lockTo.date, dateStr: lockTo.dateStr, key: `${lockTo.classId}-${lockTo.dateStr}` }]
    : classes
        .flatMap((c) =>
          upcomingOccurrencesOf(c, skips, localDateStr, { count: cap }).map((occ) => ({
            classId: c.id, day: c.day, time: c.time, endTime: c.end_time, date: occ.date, dateStr: occ.dateStr,
            key: `${c.id}-${occ.dateStr}`,
          }))
        )
        .sort((a, b) => a.dateStr.localeCompare(b.dateStr))
        .slice(0, cap);

  const [selected, setSelected] = useState(new Set(lockTo ? [options[0].key] : []));
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
    <Modal title={lockTo ? "Mark this class as absent" : "Mark upcoming classes as absent"} onClose={onClose} wide={!lockTo}>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 12, lineHeight: 1.5 }}>
        {lockTo ? (
          <>Confirm {student.name} will miss {options[0].date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })} and add a reason.</>
        ) : (
          <>
            {typeof remaining === "number" && remaining > 0 && (
              <>Showing {student.name}'s next {cap} class{cap === 1 ? "" : "es"}, based on the remaining package balance. </>
            )}
            Select which ones will be missed, add a reason, and confirm.
          </>
        )}
      </p>
      {options.length === 0 ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>No upcoming classes found.</p>
      ) : lockTo ? (
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 14, fontWeight: 600, color: T.ink, textAlign: "center" }}>
          {options[0].date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {formatTimeRange(options[0].time, options[0].endTime)}
        </div>
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
          {saving ? "Marking…" : lockTo ? "Mark absent" : `Mark absent for ${selected.size || ""} class${selected.size === 1 ? "" : "es"}`}
        </Btn>
      </div>
    </Modal>
  );
}
