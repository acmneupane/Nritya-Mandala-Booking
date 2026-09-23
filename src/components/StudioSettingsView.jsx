import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Field } from "./ui";
import { localDateStr } from "../lib/dates";
import { toCsv, downloadCsv } from "../lib/csv";

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

// Row of a date-range picker shared by the Attendance and Finances exports below —
// a plain function (not a component) so its two <input>s stay controlled by the
// caller's own from/to state instead of needing to lift state back up through props.
function dateRangeInputs(from, setFrom, to, setTo) {
  return (
    <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 12, color: T.inkSoft }}>From</label>
      <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ ...inputStyle, width: 150 }} />
      <label style={{ fontSize: 12, color: T.inkSoft }}>To</label>
      <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ ...inputStyle, width: 150 }} />
    </div>
  );
}

// Three purpose-built exports, as opposed to "Download everything" above (one raw
// JSON dump of every table) — these open cleanly in Excel/Sheets and only include
// the columns someone would actually want for a mailing list, an attendance
// register, or a bookkeeping ledger.
function CsvExport() {
  const today = localDateStr(new Date());
  const monthAgo = localDateStr(new Date(Date.now() - 30 * 86400000));

  const [studentsExporting, setStudentsExporting] = useState(false);
  const [attFrom, setAttFrom] = useState(monthAgo);
  const [attTo, setAttTo] = useState(today);
  const [attExporting, setAttExporting] = useState(false);
  const [finFrom, setFinFrom] = useState(monthAgo);
  const [finTo, setFinTo] = useState(today);
  const [finExporting, setFinExporting] = useState(false);
  const [error, setError] = useState("");

  const exportStudents = async () => {
    setStudentsExporting(true);
    setError("");
    try {
      const [sRes, levelsRes, guardiansRes, pkgRes] = await Promise.all([
        supabase.from("students").select("id, name, code, dob, level_id, archived").order("name"),
        supabase.from("levels").select("id, name"),
        supabase.from("student_guardians").select("student_id, emergency, guardians(name, phone, email)"),
        supabase.from("student_package_summary").select("student_id, classes_total, classes_used"),
      ]);
      if (sRes.error) throw new Error(sRes.error.message);
      const levelById = Object.fromEntries((levelsRes.data || []).map((l) => [l.id, l.name]));
      const pkgByStudent = Object.fromEntries((pkgRes.data || []).map((p) => [p.student_id, p]));
      const guardiansByStudent = {};
      (guardiansRes.data || []).forEach((g) => {
        if (g.guardians) (guardiansByStudent[g.student_id] ||= []).push(g.guardians);
      });

      const rows = (sRes.data || []).map((s) => {
        const guardians = guardiansByStudent[s.id] || [];
        const pkg = pkgByStudent[s.id];
        const remaining = pkg ? pkg.classes_total - pkg.classes_used : 0;
        return {
          name: s.name,
          code: s.code,
          level: levelById[s.level_id] || "",
          dob: s.dob || "",
          guardian_names: guardians.map((g) => g.name).filter(Boolean).join("; "),
          guardian_phones: guardians.map((g) => g.phone).filter(Boolean).join("; "),
          guardian_emails: guardians.map((g) => g.email).filter(Boolean).join("; "),
          classes_remaining: pkg ? remaining : "",
          archived: s.archived ? "Yes" : "No",
        };
      });

      downloadCsv(`students-${today}.csv`, toCsv(rows, [
        { key: "name", label: "Name" },
        { key: "code", label: "Code" },
        { key: "level", label: "Level" },
        { key: "dob", label: "DOB" },
        { key: "guardian_names", label: "Guardian name(s)" },
        { key: "guardian_phones", label: "Phone(s)" },
        { key: "guardian_emails", label: "Email(s)" },
        { key: "classes_remaining", label: "Classes remaining" },
        { key: "archived", label: "Archived" },
      ]));
    } catch (e) {
      setError(e.message);
    } finally {
      setStudentsExporting(false);
    }
  };

  const exportAttendance = async () => {
    if (!attFrom || !attTo) { setError("Pick both a from and to date for attendance."); return; }
    setAttExporting(true);
    setError("");
    try {
      const { data, error: err } = await supabase
        .from("attendance")
        .select("date, status, reason, students(name), classes(label)")
        .gte("date", attFrom).lte("date", attTo)
        .order("date");
      if (err) throw new Error(err.message);
      const rows = (data || []).map((a) => ({
        date: a.date,
        student: a.students?.name || "",
        class: a.classes?.label || "",
        status: a.status,
        reason: a.reason || "",
      }));
      downloadCsv(`attendance-${attFrom}-to-${attTo}.csv`, toCsv(rows, [
        { key: "date", label: "Date" },
        { key: "student", label: "Student" },
        { key: "class", label: "Class" },
        { key: "status", label: "Status" },
        { key: "reason", label: "Reason" },
      ]));
    } catch (e) {
      setError(e.message);
    } finally {
      setAttExporting(false);
    }
  };

  // A combined income/expense ledger for the range — income from confirmed package
  // purchases, expenses as their own raw rows (a recurring expense appears once,
  // as booked, not expanded into one row per occurrence — matching what's actually
  // stored rather than reproducing FinancesView's revenue-recognition math, which
  // spreads a package's income across classes as they're delivered rather than
  // listing it as a single transaction). Expense amounts are negative so the
  // Amount column nets out to a running cash total if summed.
  const exportFinances = async () => {
    if (!finFrom || !finTo) { setError("Pick both a from and to date for finances."); return; }
    setFinExporting(true);
    setError("");
    try {
      const [pkgRes, expRes] = await Promise.all([
        supabase.from("packages").select("purchase_date, amount, tier_name, payment_confirmed, students(name)")
          .eq("payment_confirmed", true).gte("purchase_date", finFrom).lte("purchase_date", finTo).order("purchase_date"),
        supabase.from("expenses").select("start_date, end_date, description, category, amount")
          .lte("start_date", finTo).order("start_date"),
      ]);
      if (pkgRes.error) throw new Error(pkgRes.error.message);
      if (expRes.error) throw new Error(expRes.error.message);

      const incomeRows = (pkgRes.data || []).map((p) => ({
        date: p.purchase_date,
        type: "Income",
        description: p.tier_name || "Package",
        student: p.students?.name || "",
        amount: Number(p.amount).toFixed(2),
      }));
      // An expense with no end_date is ongoing (still counts if it started before
      // the range ends); one with an end_date only counts if that end is on or
      // after the range's start — same "does this interval overlap the range"
      // check used elsewhere in the app (e.g. studio notices).
      const expenseRows = (expRes.data || [])
        .filter((e) => !e.end_date || e.end_date >= finFrom)
        .map((e) => ({
          date: e.start_date,
          type: "Expense",
          description: `${e.description}${e.category ? ` (${e.category})` : ""}`,
          student: "",
          amount: (-Number(e.amount)).toFixed(2),
        }));

      const rows = [...incomeRows, ...expenseRows].sort((a, b) => a.date.localeCompare(b.date));
      downloadCsv(`finances-${finFrom}-to-${finTo}.csv`, toCsv(rows, [
        { key: "date", label: "Date" },
        { key: "type", label: "Type" },
        { key: "description", label: "Description" },
        { key: "student", label: "Student" },
        { key: "amount", label: "Amount" },
      ]));
    } catch (e) {
      setError(e.message);
    } finally {
      setFinExporting(false);
    }
  };

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18, marginTop: 20 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>Export to CSV</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 16, lineHeight: 1.5 }}>
        Opens cleanly in Excel or Google Sheets — unlike the JSON backup above, these are just the columns you'd actually want for a mailing list, an attendance register, or a bookkeeping ledger.
      </p>
      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Students</div>
        <Btn size="sm" onClick={exportStudents} disabled={studentsExporting}>{studentsExporting ? "Exporting…" : "⬇ Download students.csv"}</Btn>
      </div>

      <div style={{ marginBottom: 18, borderTop: `1px solid ${T.line}`, paddingTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Attendance</div>
        {dateRangeInputs(attFrom, setAttFrom, attTo, setAttTo)}
        <Btn size="sm" onClick={exportAttendance} disabled={attExporting}>{attExporting ? "Exporting…" : "⬇ Download attendance.csv"}</Btn>
      </div>

      <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 6 }}>Finances</div>
        {dateRangeInputs(finFrom, setFinFrom, finTo, setFinTo)}
        <Btn size="sm" onClick={exportFinances} disabled={finExporting}>{finExporting ? "Exporting…" : "⬇ Download finances.csv"}</Btn>
      </div>
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
      {section === "data" && (<><EmailLimitEditor /><CsvExport /><DataExport /></>)}
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
