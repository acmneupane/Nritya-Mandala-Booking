import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Field, RichTextEditor } from "./ui";
import NoticeMessage from "./NoticeMessage";
import { noticeHasText, noticeAudienceLabel } from "../lib/notices";
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
  const [showOnPublic, setShowOnPublic] = useState(true);
  const [showOnParent, setShowOnParent] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("studio_notices").select("*").order("start_date", { ascending: false });
    setNotices(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const todayStr = localDateStr(new Date());
  const resetForm = () => { setMessage(""); setStartDate(todayStr); setEndDate(todayStr); setShowOnPublic(true); setShowOnParent(true); };

  const startAdd = () => { resetForm(); setAdding(true); setEditingId(null); };
  const startEdit = (n) => {
    setMessage(n.message); setStartDate(n.start_date); setEndDate(n.end_date);
    setShowOnPublic(n.show_on_public !== false); setShowOnParent(n.show_on_parent !== false);
    setEditingId(n.id); setAdding(false);
  };

  const save = async () => {
    if (!noticeHasText(message) || !startDate || !endDate) return;
    setSaving(true);
    const payload = { message, start_date: startDate, end_date: endDate, show_on_public: showOnPublic, show_on_parent: showOnParent };
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

  // Shared by "Add notice" and "Edit": message, dates, and where it shows.
  const noticeForm = (onCancel, saveLabel) => (
    <>
      <RichTextEditor
        label="Message"
        value={message}
        onChange={setMessage}
        placeholder="e.g. No classes this Friday — public holiday"
        minHeight={90}
      />
      <div className="grid grid-cols-2 gap-2" style={{ marginTop: 10 }}>
        <Field label="Show from"><input style={inputStyle} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
        <Field label="Show until"><input style={inputStyle} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
      </div>
      <p style={{ fontSize: 11, color: T.inkSoft, marginTop: -6, marginBottom: 10 }}>
        The notice is only visible between these dates. For an upcoming event (e.g. a holiday closure), start showing it a week or two ahead.
      </p>
      <div style={{ marginBottom: 10 }}>
        <span className="block text-xs font-medium mb-1" style={{ color: T.inkSoft }}>Show on</span>
        <label className="flex items-center gap-2" style={{ fontSize: 13, color: T.ink, marginBottom: 4 }}>
          <input type="checkbox" checked={showOnPublic} onChange={(e) => setShowOnPublic(e.target.checked)} />
          Public homepage
        </label>
        <label className="flex items-center gap-2" style={{ fontSize: 13, color: T.ink }}>
          <input type="checkbox" checked={showOnParent} onChange={(e) => setShowOnParent(e.target.checked)} />
          Parent page (website and mobile app)
        </label>
        <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>
          {!showOnPublic && !showOnParent ? "Staff only — shows on the Home dashboard and nowhere else." : "Always shows on the staff Home dashboard too."}
        </p>
      </div>
      <div className="flex justify-end gap-2 mt-1">
        <Btn variant="ghost" size="sm" onClick={onCancel}>Cancel</Btn>
        <Btn size="sm" onClick={save} disabled={saving || !noticeHasText(message)}>{saving ? "Saving…" : saveLabel}</Btn>
      </div>
    </>
  );

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18, marginTop: 20 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>Notice board</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        Shows for any day within the date range you set — a single day, a whole week, whatever fits — on the pages you tick: the public homepage and/or the parent page (website and app). Always shows on the Home dashboard. Multiple notices can be active at once.
      </p>

      {loading ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>
      ) : (
        <div className="grid gap-2 mb-4">
          {notices.length === 0 && <p style={{ fontSize: 13, color: T.inkSoft }}>No notices yet.</p>}
          {notices.map((n) => (
            editingId === n.id ? (
              <div key={n.id} style={{ border: `1px solid ${T.gold}`, borderRadius: 8, padding: 10 }}>
                {noticeForm(() => setEditingId(null), "Save changes")}
              </div>
            ) : (
              <div key={n.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, border: `1px solid ${T.line}`, borderLeft: `3px solid ${isActive(n) ? T.sage : T.line}`, borderRadius: 6, padding: "8px 12px", fontSize: 13 }}>
                <div style={{ minWidth: 0 }}>
                  <NoticeMessage message={n.message} style={{ color: T.ink, fontSize: 13, lineHeight: 1.5 }} />
                  <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
                    Showing {n.start_date === n.end_date ? `on ${n.start_date}` : `${n.start_date} – ${n.end_date}`}
                    {" · "}{noticeAudienceLabel(n)}
                    {isActive(n) && <span style={{ color: T.sage, fontWeight: 600 }}> · Active now</span>}
                    {n.start_date > todayStr && <span style={{ color: T.gold, fontWeight: 600 }}> · Not showing yet</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
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
          {noticeForm(() => setAdding(false), "Add notice")}
        </div>
      ) : (
        <Btn size="sm" variant="ghost" onClick={startAdd}>+ Add notice</Btn>
      )}
    </div>
  );
}

function ReferralRewardsConfig() {
  const [enabled, setEnabled] = useState(false);
  const [perFreeClass, setPerFreeClass] = useState("1");
  const [referredGetsFree, setReferredGetsFree] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from("settings").select("referral_program_enabled, referrals_per_free_class, referred_student_gets_free_class").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) {
        setEnabled(data.referral_program_enabled);
        setPerFreeClass(String(data.referrals_per_free_class));
        setReferredGetsFree(data.referred_student_gets_free_class);
      }
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await supabase.from("settings").update({
      referral_program_enabled: enabled,
      referrals_per_free_class: Math.max(1, Number(perFreeClass) || 1),
      referred_student_gets_free_class: referredGetsFree,
    }).eq("id", 1);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>;

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18, marginTop: 20 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>Referral rewards</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        A family's "Refer a friend" link carries their code — when someone enrols through it and their request is approved, the reward below is issued automatically as a free class (a $0 package row), not just noted for you to action manually. You can still edit or remove that package afterward like any other.
      </p>
      <label className="flex items-center gap-2 mb-3" style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Referral program on
      </label>
      <Field label="Referrals needed for 1 free class">
        <input style={{ ...inputStyle, maxWidth: 120 }} type="number" min={1} value={perFreeClass} onChange={(e) => setPerFreeClass(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 mb-3" style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>
        <input type="checkbox" checked={referredGetsFree} onChange={(e) => setReferredGetsFree(e.target.checked)} />
        The new (referred) family also gets 1 free class
      </label>
      {saved && <p style={{ color: T.sage, fontSize: 13, marginBottom: 10, fontWeight: 600 }}>Saved.</p>}
      <Btn variant="success" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
    </div>
  );
}

export default function StudioSettingsView() {
  const [section, setSection] = useState("fee");

  const SECTIONS = [
    { id: "fee", label: "Enrolment fee" },
    { id: "referrals", label: "Referral rewards" },
    { id: "notices", label: "Notices" },
  ];

  return (
    <div style={{ maxWidth: 460 }}>
      <div className="flex gap-1 mb-4 flex-wrap" style={{ background: T.paper, borderRadius: 8, padding: 3, display: "inline-flex" }}>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, background: section === s.id ? "#fff" : "transparent", color: section === s.id ? T.maroonDark : T.inkSoft, fontWeight: section === s.id ? 600 : 400 }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "fee" && <EnrolmentFeesEditor />}
      {section === "referrals" && <ReferralRewardsConfig />}
      {section === "notices" && <NoticeBoardEditor />}
    </div>
  );
}
