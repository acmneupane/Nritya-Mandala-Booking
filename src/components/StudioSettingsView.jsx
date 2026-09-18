import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Field } from "./ui";
import { localDateStr } from "../lib/dates";

function EmailTemplateEditor({ templateKey, title, description, placeholders }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from("email_templates").select("subject, body").eq("key", templateKey).maybeSingle().then(({ data }) => {
      if (data) { setSubject(data.subject); setBody(data.body); }
      setLoading(false);
    });
  }, [templateKey]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await supabase.from("email_templates").update({ subject, body, updated_at: new Date().toISOString() }).eq("key", templateKey);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>;

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18, marginTop: 20 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>{title}</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        {description} Available placeholders:{" "}
        {placeholders.map((p) => (
          <code key={p} style={{ background: T.paper, padding: "1px 5px", borderRadius: 4, marginRight: 4 }}>{`{{${p}}}`}</code>
        ))}
      </p>
      <Field label="Subject"><input style={inputStyle} value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
      <Field label="Body"><textarea style={{ ...inputStyle, minHeight: 220, fontFamily: "monospace", fontSize: 13 }} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
      {saved && <p style={{ color: T.sage, fontSize: 13, marginBottom: 10, fontWeight: 600 }}>Saved.</p>}
      <Btn variant="success" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save template"}</Btn>
    </div>
  );
}

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

function CapacityEditor() {
  const [days, setDays] = useState("");
  const [dueThreshold, setDueThreshold] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from("settings").select("renewal_grace_period_days, due_threshold").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) { setDays(String(data.renewal_grace_period_days)); setDueThreshold(String(data.due_threshold)); }
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await supabase.from("settings").update({ renewal_grace_period_days: Number(days), due_threshold: Number(dueThreshold) }).eq("id", 1);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>;

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18, marginTop: 20 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>Renewal grace period</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        When a student's package runs out, they keep their spot in the class for this many days before it's counted as available to a new enrolment. Set to 0 to free the spot immediately once their package is empty.
      </p>
      <Field label="Grace period (days)"><input style={inputStyle} type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} /></Field>

      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6, marginTop: 16 }}>"Coming due" threshold</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        A student counts as due for renewal once their remaining classes drop to this number or fewer. Used as the default in Renewal Requests → Due for renewal (which can still be adjusted there for a one-off look), the renewals count badge, and the "running low" notice on the parent page.
      </p>
      <Field label="Classes remaining"><input style={inputStyle} type="number" min={0} value={dueThreshold} onChange={(e) => setDueThreshold(e.target.value)} /></Field>

      {saved && <p style={{ color: T.sage, fontSize: 13, marginBottom: 10, fontWeight: 600 }}>Saved.</p>}
      <Btn variant="success" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
    </div>
  );
}

const BACKUP_TABLES = [
  "students", "guardians", "student_guardians", "levels", "level_history",
  "classes", "enrollments", "attendance", "class_skips",
  "packages", "package_tiers", "enrolment_fee_charges",
  "enrollment_requests", "enrollment_request_students", "package_renewal_requests",
  "expenses", "settings", "email_templates", "audit_log",
];

function EmailLimitEditor() {
  const [limit, setLimit] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from("settings").select("resend_daily_limit, resend_monthly_limit").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) { setLimit(String(data.resend_daily_limit)); setMonthlyLimit(String(data.resend_monthly_limit)); }
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await supabase.from("settings").update({ resend_daily_limit: Number(limit), resend_monthly_limit: Number(monthlyLimit) }).eq("id", 1);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>;

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18, marginBottom: 16 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>Email Sending Limits (Free Plan)</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        Resend's free plan allows 100 emails per day and 3,000 per month. Once either is reached (every recipient counted, including Bcc), Send buttons offer a "copy and send yourself" option instead of sending automatically.
      </p>
      <p style={{ fontSize: 15, fontWeight: 700, color: T.terracotta, marginBottom: 14, lineHeight: 1.5 }}>
        ⚠ Before changing these numbers, please check Resend.com's current free plan limits. Changing these without checking may cause emails to fail silently or unexpected charges.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Emails per day"><input style={inputStyle} type="number" min={1} value={limit} onChange={(e) => setLimit(e.target.value)} /></Field>
        <Field label="Emails per month"><input style={inputStyle} type="number" min={1} value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} /></Field>
      </div>
      {saved && <p style={{ color: T.sage, fontSize: 13, marginBottom: 10, fontWeight: 600 }}>Saved.</p>}
      <Btn variant="success" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
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

function DataExport() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const exportAll = async () => {
    setExporting(true);
    setError("");
    try {
      const backup = { exported_at: new Date().toISOString() };
      for (const table of BACKUP_TABLES) {
        const { data, error } = await supabase.from(table).select("*");
        if (error) throw new Error(`Couldn't export ${table}: ${error.message}`);
        backup[table] = data || [];
      }
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nritya-mandala-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18, marginTop: 20 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>Download everything</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        Exports every table in the system — students, classes, attendance, packages, renewals, finances, and more — as one JSON file. Useful as a safety-net backup you keep for yourself, separate from what's stored online.
      </p>
      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 10 }}>{error}</p>}
      <Btn onClick={exportAll} disabled={exporting}>{exporting ? "Exporting…" : "⬇ Download all data (.json)"}</Btn>
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
          onClick={() => setSection("capacity")}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, background: section === "capacity" ? "#fff" : "transparent", color: section === "capacity" ? T.maroonDark : T.inkSoft, fontWeight: section === "capacity" ? 600 : 400 }}
        >
          Capacity
        </button>
        <button
          onClick={() => setSection("emails")}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, background: section === "emails" ? "#fff" : "transparent", color: section === "emails" ? T.maroonDark : T.inkSoft, fontWeight: section === "emails" ? 600 : 400 }}
        >
          Email templates
        </button>
        <button
          onClick={() => setSection("notices")}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, background: section === "notices" ? "#fff" : "transparent", color: section === "notices" ? T.maroonDark : T.inkSoft, fontWeight: section === "notices" ? 600 : 400 }}
        >
          Notices
        </button>
        <button
          onClick={() => setSection("data")}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, background: section === "data" ? "#fff" : "transparent", color: section === "data" ? T.maroonDark : T.inkSoft, fontWeight: section === "data" ? 600 : 400 }}
        >
          Data
        </button>
      </div>

      {section === "fee" && <EnrolmentFeesEditor />}
      {section === "capacity" && <CapacityEditor />}
      {section === "notices" && <NoticeBoardEditor />}
      {section === "data" && (<><EmailLimitEditor /><DataExport /></>)}
      {section === "emails" && (
        <>
          <EmailTemplateEditor
            templateKey="enrollment_approved"
            title="Enrolment approval email"
            description="Sent automatically to the parent when you approve their request."
            placeholders={["student_name", "day", "time", "start_date", "access_code", "qr_link", "qr_code_image"]}
          />
          <EmailTemplateEditor
            templateKey="package_expired"
            title="Payment required (package expired) email"
            description="Sent when you click 'Payment required' on a student whose package has run out. This is the default — you can also tweak the wording for a single send from the preview screen right before it goes out. The Facebook footer is added automatically and isn't part of this text."
            placeholders={["student_name", "package_size", "classes_used", "status_text", "renew_link"]}
          />
          <EmailTemplateEditor
            templateKey="renewal_approved"
            title="Renewal confirmed email"
            description="Sent to the parent when you approve a renewal request. This is the default — you can also tweak the wording for a single send from the preview screen right before it goes out. The Facebook footer is added automatically and isn't part of this text."
            placeholders={["student_name", "tier_name", "classes_total", "amount"]}
          />
        </>
      )}
    </div>
  );
}
