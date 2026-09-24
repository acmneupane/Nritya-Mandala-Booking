import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Field } from "./ui";
import { localDateStr, formatSydneyDateTime } from "../lib/dates";
import { toCsv, downloadCsv } from "../lib/csv";
import TeamView from "./TeamView";

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

function BankDetailsConfig() {
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bsb, setBsb] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from("admin_settings").select("bank_name, bank_account_name, bank_bsb, bank_account_number").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) {
        setBankName(data.bank_name);
        setAccountName(data.bank_account_name);
        setBsb(data.bank_bsb);
        setAccountNumber(data.bank_account_number);
      }
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await supabase.from("admin_settings").update({
      bank_name: bankName.trim(), bank_account_name: accountName.trim(), bank_bsb: bsb.trim(), bank_account_number: accountNumber.trim(),
    }).eq("id", 1);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>;

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18, marginTop: 20 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>Bank account details</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        Shown to parents on the enrolment and renewal payment screens, alongside their payment reference.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bank"><input style={inputStyle} value={bankName} onChange={(e) => setBankName(e.target.value)} /></Field>
        <Field label="Account name"><input style={inputStyle} value={accountName} onChange={(e) => setAccountName(e.target.value)} /></Field>
        <Field label="BSB"><input style={inputStyle} value={bsb} onChange={(e) => setBsb(e.target.value)} /></Field>
        <Field label="Account number"><input style={inputStyle} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} /></Field>
      </div>
      {saved && <p style={{ color: T.sage, fontSize: 13, marginBottom: 10, fontWeight: 600 }}>Saved.</p>}
      <Btn variant="success" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save bank details"}</Btn>
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
    supabase.from("admin_settings").select("renewal_grace_period_days, due_threshold").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) { setDays(String(data.renewal_grace_period_days)); setDueThreshold(String(data.due_threshold)); }
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await supabase.from("admin_settings").update({ renewal_grace_period_days: Number(days), due_threshold: Number(dueThreshold) }).eq("id", 1);
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
        A student counts as due for renewal once their remaining classes drop to this number or fewer. Used as the default in Renewal Requests → Due for renewal (which can still be adjusted there for a one-off look), the renewals count badge, the "running low" notice on the parent page, and the automated renewal reminder checkpoints below.
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
  "expenses", "settings", "admin_settings", "email_templates", "audit_log",
  "scheduled_runs", "scheduled_run_students",
];

function EmailLimitEditor() {
  const [limit, setLimit] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from("admin_settings").select("resend_daily_limit, resend_monthly_limit").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) { setLimit(String(data.resend_daily_limit)); setMonthlyLimit(String(data.resend_monthly_limit)); }
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await supabase.from("admin_settings").update({ resend_daily_limit: Number(limit), resend_monthly_limit: Number(monthlyLimit) }).eq("id", 1);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>;

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18, marginBottom: 16 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>Email Sending Limits (Free Plan)</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        Resend's free plan allows 100 emails per day and 3,000 per month. Once either is reached (every recipient counted, including Bcc), Send buttons offer a "copy and send yourself" option instead of sending automatically. Shared across every email type in the app, including automated renewal reminders.
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

function RenewalReminderConfig() {
  const [enabled, setEnabled] = useState(false);
  const [cron, setCron] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from("admin_settings").select("auto_renewal_reminders_enabled, renewal_reminder_cron, renewal_reminder_test_email").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) {
        setEnabled(data.auto_renewal_reminders_enabled);
        setCron(data.renewal_reminder_cron);
        setTestEmail(data.renewal_reminder_test_email || "");
      }
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await supabase.from("admin_settings").update({
      auto_renewal_reminders_enabled: enabled,
      renewal_reminder_cron: cron.trim() || "0 9 * * 1",
      renewal_reminder_test_email: testEmail.trim() || null,
    }).eq("id", 1);
    // Re-applies the saved cron expression to the actual pg_cron job — without
    // this the schedule field would just sit in the database with no effect
    // until the job happened to be touched some other way.
    await supabase.rpc("sync_renewal_reminder_cron");
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>;

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18, marginBottom: 16 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>Automated renewal reminders</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        On every run — on the schedule below, regardless of the checkbox — checks every active, booked student against the "Coming due" threshold (Capacity, above) and works out who has newly reached a checkpoint (coming due, half of coming due, or fully out) since their last reminder. The cycle resets whenever they buy a new package. Uses the same "Payment required" email template and shared Resend budget as manual reminders (prioritizing whoever's most overdue if the budget runs tight). A student can opt out from their own record in the Students tab.
      </p>
      <label className="flex items-center gap-2 mb-3" style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Send emails automatically
      </label>
      <p style={{ fontSize: 11, color: T.inkSoft, marginTop: -8, marginBottom: 14 }}>
        While this is off, runs still happen on schedule and the log below still fills in — each candidate is recorded as "would send" instead of actually emailed. Nothing goes out until this is checked, so it's safe to leave off and watch a few real runs before switching it on.
      </p>
      <Field label={<>Schedule (cron expression, <strong style={{ fontSize: 15, color: T.terracotta }}>UTC</strong>)</>}>
        <input style={inputStyle} value={cron} onChange={(e) => setCron(e.target.value)} placeholder="0 22 * * 0" />
      </Field>
      <p style={{ fontSize: 11, color: T.inkSoft, marginTop: -8, marginBottom: 14 }}>
        Always enter this in <strong>UTC</strong>, not Sydney time — Supabase's scheduler doesn't support a Sydney timezone without a full database restart, so this field is deliberately left in UTC. E.g. <code style={{ background: T.paper, padding: "1px 5px", borderRadius: 4 }}>0 22 * * 0</code> = Sunday 10:00pm UTC = Monday 9:00am AEDT. Remember to nudge it by an hour around Sydney's daylight saving changes. Checkpoints are based on remaining classes, not calendar days, so a weekly check is enough — classes recur weekly anyway.
      </p>
      <Field label="Test email override (optional)">
        <input style={inputStyle} type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" />
      </Field>
      <p style={{ fontSize: 11, color: T.inkSoft, marginTop: -8, marginBottom: 14 }}>
        While set, every real send redirects here instead of the real guardians (the subject line shows who it would really have gone to) — independent of "Send emails automatically" above, so both need to be set deliberately before any real send goes out.
      </p>
      {saved && <p style={{ color: T.sage, fontSize: 13, marginBottom: 10, fontWeight: 600 }}>Saved.</p>}
      <Btn variant="success" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
    </div>
  );
}

const OUTCOME_LABEL = {
  sent_zero: "Sent — fully out",
  sent_half: "Sent — half of coming due",
  sent_coming_due: "Sent — coming due",
  would_send_zero: "Would send — fully out",
  would_send_half: "Would send — half of coming due",
  would_send_coming_due: "Would send — coming due",
  skipped_opted_out: "Skipped — opted out",
  skipped_already_sent_this_cycle: "Skipped — already sent this cycle",
  skipped_no_guardian_email: "Skipped — no guardian email on file",
  skipped_email_limit_reached: "Skipped — email budget reached",
  skipped_send_error: "Skipped — send failed",
};

function ScheduledRunsLog() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState({}); // run id -> rows
  const [detailLoading, setDetailLoading] = useState(null);

  useEffect(() => {
    supabase.from("scheduled_runs").select("*").eq("run_name", "renewal_reminders").order("run_at", { ascending: false }).limit(15).then(({ data }) => {
      setRuns(data || []);
      setLoading(false);
    });
  }, []);

  const toggleExpand = async (run) => {
    if (expanded === run.id) { setExpanded(null); return; }
    setExpanded(run.id);
    if (!detail[run.id]) {
      setDetailLoading(run.id);
      const { data } = await supabase.from("scheduled_run_students").select("outcome, reason, students(name, code)").eq("scheduled_run_id", run.id);
      setDetail((d) => ({ ...d, [run.id]: data || [] }));
      setDetailLoading(null);
    }
  };

  if (loading) return <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>;

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>Scheduled run log</h3>
      {runs.length === 0 ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>No runs yet — one will appear here the first time the schedule fires.</p>
      ) : (
        <div className="grid gap-2">
          {runs.map((r) => (
            <div key={r.id} style={{ border: `1px solid ${T.line}`, borderRadius: 8 }}>
              <button
                onClick={() => toggleExpand(r)}
                className="flex items-center justify-between gap-2"
                style={{ width: "100%", textAlign: "left", padding: "10px 12px", background: "transparent", border: "none", cursor: "pointer" }}
              >
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{formatSydneyDateTime(r.run_at)}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, marginLeft: 8, textTransform: "uppercase", letterSpacing: 0.3,
                    color: r.status === "error" ? T.terracotta : r.status === "dry_run" ? T.gold : T.sage,
                  }}>
                    {r.status === "dry_run" ? "dry run" : r.status}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: T.inkSoft }}>{r.checked_count} checked · {r.sent_count} sent</span>
              </button>
              {r.error_message && <p style={{ fontSize: 12, color: T.terracotta, padding: "0 12px 10px" }}>{r.error_message}</p>}
              {expanded === r.id && (
                <div style={{ borderTop: `1px solid ${T.line}`, padding: "10px 12px" }}>
                  {detailLoading === r.id ? (
                    <p style={{ fontSize: 12, color: T.inkSoft }}>Loading…</p>
                  ) : (detail[r.id] || []).length === 0 ? (
                    <p style={{ fontSize: 12, color: T.inkSoft }}>Nobody was checked in this run.</p>
                  ) : (
                    <div className="grid gap-1">
                      {(detail[r.id] || []).map((row, i) => (
                        <div key={i} className="flex items-center justify-between gap-2" style={{ fontSize: 12 }}>
                          <span style={{ color: T.ink }}>{row.students?.name || "Unknown"}{row.students?.code ? ` (${row.students.code})` : ""}</span>
                          <span style={{ color: row.outcome === "sent" ? T.sage : row.reason?.startsWith("would_send") ? T.gold : T.inkSoft, flexShrink: 0 }}>{OUTCOME_LABEL[row.reason] || row.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminConfigView() {
  const [section, setSection] = useState("capacity");

  const SECTIONS = [
    { id: "capacity", label: "Capacity" },
    { id: "bank", label: "Bank details" },
    { id: "renewals", label: "Renewal reminders" },
    { id: "emails", label: "Email templates" },
    { id: "data", label: "Data" },
    { id: "team", label: "Team" },
  ];

  return (
    <div style={{ maxWidth: 620 }}>
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

      {section === "capacity" && <CapacityEditor />}
      {section === "bank" && <BankDetailsConfig />}
      {section === "renewals" && (<><RenewalReminderConfig /><ScheduledRunsLog /></>)}
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
            description="Sent when you click 'Payment required' on a student whose package has run out, and by the automated renewal reminder above. This is the default — you can also tweak the wording for a single manual send from the preview screen right before it goes out. The Facebook footer (and, for automated sends, an opt-out line) is added automatically and isn't part of this text."
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
      {section === "team" && <TeamView />}
    </div>
  );
}
