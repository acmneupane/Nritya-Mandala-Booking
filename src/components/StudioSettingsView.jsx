import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Field } from "./ui";
import { localDateStr } from "../lib/dates";

function EnrolmentFeesEditor() {
  const [enabled, setEnabled] = useState(false);
  const [label, setLabel] = useState("");
  const [primary, setPrimary] = useState("");
  const [sibling, setSibling] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from("settings").select("enrolment_fee_enabled, enrolment_fee_label, enrolment_fee_primary, enrolment_fee_sibling").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) {
        setEnabled(data.enrolment_fee_enabled);
        setLabel(data.enrolment_fee_label);
        setPrimary(String(data.enrolment_fee_primary));
        setSibling(String(data.enrolment_fee_sibling));
      }
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await supabase.from("settings").update({
      enrolment_fee_enabled: enabled, enrolment_fee_label: label.trim() || "One-off Enrolment fee",
      enrolment_fee_primary: Number(primary), enrolment_fee_sibling: Number(sibling),
    }).eq("id", 1);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>;

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18, marginTop: 20 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>Enrolment fee</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        A one-off fee shown and charged on the enrolment form — applies even before a class is available, if enabled.
      </p>
      <label className="flex items-center gap-2 mb-3" style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Charge this fee on new enrolments
      </label>
      <Field label="Label shown to parents"><input style={inputStyle} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="One-off Enrolment fee" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Primary student ($)"><input style={inputStyle} type="number" step="0.01" min={0} value={primary} onChange={(e) => setPrimary(e.target.value)} /></Field>
        <Field label="Additional student ($)"><input style={inputStyle} type="number" step="0.01" min={0} value={sibling} onChange={(e) => setSibling(e.target.value)} /></Field>
      </div>
      {saved && <p style={{ color: T.sage, fontSize: 13, marginBottom: 10, fontWeight: 600 }}>Saved.</p>}
      <Btn variant="success" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save fees"}</Btn>
    </div>
  );
}

function NoticeBoardEditor() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("studio_notices").select("*").order("start_date", { ascending: false });
    setNotices(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const todayStr = localDateStr(new Date());
  const resetForm = () => { setMessage(""); setStartDate(todayStr); setEndDate(todayStr); };

  const startAdd = () => { resetForm(); setAdding(true); setEditingId(null); };
  const startEdit = (n) => { setMessage(n.message); setStartDate(n.start_date); setEndDate(n.end_date); setEditingId(n.id); setAdding(false); };

  const save = async () => {
    if (!message.trim() || !startDate || !endDate) return;
    setSaving(true);
    const payload = { message: message.trim(), start_date: startDate, end_date: endDate };
    if (editingId) {
      await supabase.from("studio_notices").update(payload).eq("id", editingId);
    } else {
      await supabase.from("studio_notices").insert(payload);
    }
    setSaving(false);
    setAdding(false);
    setEditingId(null);
    load();
  };

  const remove = async (id) => {
    await supabase.from("studio_notices").delete().eq("id", id);
    load();
  };

  const isActive = (n) => n.start_date <= todayStr && todayStr <= n.end_date;

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18, marginTop: 20 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>Notice board</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        Shows on the Home dashboard and the parent page for any day within the date range you set — a single day, a whole week, whatever fits. Multiple notices can be active at once.
      </p>

      {loading ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>
      ) : (
        <div className="grid gap-2 mb-4">
          {notices.length === 0 && <p style={{ fontSize: 13, color: T.inkSoft }}>No notices yet.</p>}
          {notices.map((n) => (
            editingId === n.id ? (
              <div key={n.id} style={{ border: `1px solid ${T.gold}`, borderRadius: 8, padding: 10 }}>
                <Field label="Message"><input style={inputStyle} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="From"><input style={inputStyle} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
                  <Field label="To"><input style={inputStyle} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
                </div>
                <div className="flex justify-end gap-2 mt-1">
                  <Btn variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Btn>
                  <Btn size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Btn>
                </div>
              </div>
            ) : (
              <div key={n.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${T.line}`, borderLeft: `3px solid ${isActive(n) ? T.sage : T.line}`, borderRadius: 6, padding: "8px 12px", fontSize: 13 }}>
                <div>
                  <span style={{ color: T.ink }}>{n.message}</span>
                  <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
                    {n.start_date === n.end_date ? n.start_date : `${n.start_date} – ${n.end_date}`}
                    {isActive(n) && <span style={{ color: T.sage, fontWeight: 600 }}> · Active now</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit(n)} style={{ color: T.maroon, fontSize: 12 }}>Edit</button>
                  <button onClick={() => remove(n.id)} style={{ color: T.terracotta, fontSize: 12 }}>Delete</button>
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {adding ? (
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 10 }}>
          <Field label="Message"><input style={inputStyle} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. No classes this Friday — public holiday" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="From"><input style={inputStyle} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            <Field label="To"><input style={inputStyle} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
          </div>
          <div className="flex justify-end gap-2 mt-1">
            <Btn variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Btn>
            <Btn size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Add notice"}</Btn>
          </div>
        </div>
      ) : (
        <Btn size="sm" variant="ghost" onClick={startAdd}>+ Add notice</Btn>
      )}
    </div>
  );
}

export default function StudioSettingsView() {
  const [section, setSection] = useState("fee");

  return (
    <div style={{ maxWidth: 460 }}>
      <div className="flex gap-1 mb-4" style={{ background: T.paper, borderRadius: 8, padding: 3, display: "inline-flex" }}>
        <button
          onClick={() => setSection("fee")}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, background: section === "fee" ? "#fff" : "transparent", color: section === "fee" ? T.maroonDark : T.inkSoft, fontWeight: section === "fee" ? 600 : 400 }}
        >
          Enrolment fee
        </button>
        <button
          onClick={() => setSection("notices")}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, background: section === "notices" ? "#fff" : "transparent", color: section === "notices" ? T.maroonDark : T.inkSoft, fontWeight: section === "notices" ? 600 : 400 }}
        >
          Notices
        </button>
      </div>

      {section === "fee" && <EnrolmentFeesEditor />}
      {section === "notices" && <NoticeBoardEditor />}
    </div>
  );
}
