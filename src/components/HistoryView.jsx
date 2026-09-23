import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Modal } from "./ui";
import { formatSydneyDate, formatSydneyDateTime } from "../lib/dates";

const TABLE_LABELS = { students: "Students", classes: "Classes", levels: "Levels" };
const ACTION_COLOR = { insert: T.sage, update: T.gold, delete: T.terracotta };
const ACTION_LABEL = { insert: "Added", update: "Updated", delete: "Deleted" };
const EMAIL_TYPE_LABELS = {
  booking_confirmation: "Booking confirmation",
  payment_reminder: "Payment reminder",
  studio_notification_enrolment: "Studio notification (enrolment)",
  studio_notification_renewal: "Studio notification (renewal)",
  studio_notification_absence: "Studio notification (absence)",
};

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatSydneyDate(d);
}

const PAGE_SIZE = 25;

function EmailsSection() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState(null); // { today, month, dailyLimit }
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null); // the email_log row currently shown in the detail modal

  const load = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
    const [listRes, todayRes, monthRes, settingsRes] = await Promise.all([
      supabase.from("email_log").select("*", { count: "exact" }).order("sent_at", { ascending: false }).range(from, to),
      supabase.from("email_log").select("id", { count: "exact", head: true }).gte("sent_at", startOfDay.toISOString()),
      supabase.from("email_log").select("id", { count: "exact", head: true }).gte("sent_at", startOfMonth.toISOString()),
      supabase.from("admin_settings").select("resend_daily_limit, resend_monthly_limit").eq("id", 1).maybeSingle(),
    ]);
    setRows(listRes.data || []);
    setTotal(listRes.count || 0);
    setSummary({ today: todayRes.count || 0, month: monthRes.count || 0, dailyLimit: settingsRes.data?.resend_daily_limit || 100, monthlyLimit: settingsRes.data?.resend_monthly_limit || 3000 });
    setLoading(false);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      {summary && (
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${summary.today >= summary.dailyLimit ? T.terracotta : summary.today >= summary.dailyLimit * 0.8 ? T.gold : T.sage}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600 }}>SENT TODAY</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.maroonDark, fontFamily: "Fraunces, serif" }}>{summary.today} <span style={{ fontSize: 13, color: T.inkSoft, fontFamily: "Inter, sans-serif" }}>/ {summary.dailyLimit}</span></div>
          </div>
          <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${summary.month >= summary.monthlyLimit ? T.terracotta : summary.month >= summary.monthlyLimit * 0.8 ? T.gold : T.sage}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600 }}>SENT THIS MONTH</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.maroonDark, fontFamily: "Fraunces, serif" }}>{summary.month} <span style={{ fontSize: 13, color: T.inkSoft, fontFamily: "Inter, sans-serif" }}>/ {summary.monthlyLimit}</span></div>
          </div>
          <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${T.maroon}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600 }}>ALL TIME (LOGGED)</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.maroonDark, fontFamily: "Fraunces, serif" }}>{total}</div>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: T.inkSoft }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: T.inkSoft }}>No emails logged yet.</p>
      ) : (
        <div className="grid gap-2">
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setViewing(r)}
              style={{ display: "block", width: "100%", textAlign: "left", background: "#fff", border: `1px solid ${T.line}`, borderLeft: `3px solid ${r.success ? T.sage : T.terracotta}`, borderRadius: 6, padding: "10px 12px", cursor: "pointer" }}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>
                  {r.recipient_email} {r.recipient_role === "bcc" && <span style={{ fontSize: 10, color: T.inkSoft, fontWeight: 600 }}>(BCC)</span>}
                </span>
                <span style={{ fontSize: 11, color: T.inkSoft, whiteSpace: "nowrap" }}>{timeAgo(r.sent_at)}</span>
              </div>
              <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
                {EMAIL_TYPE_LABELS[r.email_type] || r.email_type} · {r.student_name || "—"} · sent by {r.triggered_by || "unknown"}
                {!r.success && <span style={{ color: T.terracotta, fontWeight: 600 }}> · Failed</span>}
              </div>
              {r.subject && <div style={{ fontSize: 12, color: T.ink, marginTop: 4, fontStyle: "italic" }}>{r.subject}</div>}
            </button>
          ))}
        </div>
      )}

      {viewing && (
        <Modal title="Email details" onClose={() => setViewing(null)} wide>
          <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10, lineHeight: 1.6 }}>
            <div><strong>To:</strong> {viewing.recipient_email}{viewing.recipient_role === "bcc" ? " (BCC)" : ""}</div>
            <div><strong>Subject:</strong> {viewing.subject || "(no subject)"}</div>
            <div><strong>Type:</strong> {EMAIL_TYPE_LABELS[viewing.email_type] || viewing.email_type}</div>
            <div><strong>Student:</strong> {viewing.student_name || "—"}</div>
            <div><strong>Sent:</strong> {formatSydneyDateTime(viewing.sent_at)} by {viewing.triggered_by || "unknown"}</div>
            {!viewing.success && <div style={{ color: T.terracotta, fontWeight: 600 }}>This send failed.</div>}
          </div>
          {viewing.body ? (
            <div
              style={{ fontSize: 13, color: T.ink, lineHeight: 1.6, background: T.paper, border: `1px solid ${T.line}`, borderRadius: 8, padding: 14, maxHeight: 480, overflowY: "auto" }}
              dangerouslySetInnerHTML={{ __html: viewing.body }}
            />
          ) : (
            <p style={{ fontSize: 13, color: T.inkSoft }}>No content was recorded for this email.</p>
          )}
          <div className="flex justify-end mt-4">
            <button onClick={() => setViewing(null)} style={{ fontSize: 13, color: T.maroon, fontWeight: 600, padding: "6px 12px" }}>Close</button>
          </div>
        </Modal>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span style={{ fontSize: 12, color: T.inkSoft }}>Page {page} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ fontSize: 12, color: page === 1 ? `${T.inkSoft}66` : T.maroon, fontWeight: 500 }}>← Prev</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ fontSize: 12, color: page === totalPages ? `${T.inkSoft}66` : T.maroon, fontWeight: 500 }}>Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HistoryView() {
  const [section, setSection] = useState("audit"); // 'audit' | 'emails'
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTable, setFilterTable] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
    setEntries(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { if (section === "audit") load(); }, [load, section]);

  const filtered = filterTable === "all" ? entries : entries.filter((e) => e.table_name === filterTable);

  return (
    <div>
      <div className="flex gap-1 mb-4" style={{ background: T.paper, borderRadius: 8, padding: 3, display: "inline-flex" }}>
        <button
          onClick={() => setSection("audit")}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, background: section === "audit" ? "#fff" : "transparent", color: section === "audit" ? T.maroonDark : T.inkSoft, fontWeight: section === "audit" ? 600 : 400 }}
        >
          Audit Log
        </button>
        <button
          onClick={() => setSection("emails")}
          style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, background: section === "emails" ? "#fff" : "transparent", color: section === "emails" ? T.maroonDark : T.inkSoft, fontWeight: section === "emails" ? 600 : 400 }}
        >
          Emails
        </button>
      </div>

      {section === "emails" ? (
        <EmailsSection />
      ) : loading ? (
        <p style={{ color: T.inkSoft }}>Loading…</p>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4">
            {["all", "students", "classes", "levels"].map((t) => (
              <button
                key={t}
                onClick={() => setFilterTable(t)}
                style={{
                  fontSize: 12, padding: "5px 12px", borderRadius: 999,
                  background: filterTable === t ? T.maroon : "#fff",
                  color: filterTable === t ? T.ivory : T.inkSoft,
                  border: `1px solid ${filterTable === t ? T.maroon : T.line}`,
                  fontWeight: filterTable === t ? 600 : 400,
                }}
              >
                {t === "all" ? "All" : TABLE_LABELS[t]}
              </button>
            ))}
          </div>

          {filtered.length === 0 && <p style={{ color: T.inkSoft }}>No history yet.</p>}

          <div className="grid gap-2">
            {filtered.map((e) => (
              <div key={e.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", background: "#fff", border: `1px solid ${T.line}`, borderLeft: `3px solid ${ACTION_COLOR[e.action]}`, borderRadius: 6, padding: "10px 12px" }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{e.summary}</span>
                  <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
                    {ACTION_LABEL[e.action]} · {TABLE_LABELS[e.table_name] || e.table_name} · {e.actor_email || "Unknown user"}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: T.inkSoft, whiteSpace: "nowrap", marginLeft: 12 }}>{timeAgo(e.created_at)}</span>
              </div>
            ))}
          </div>
          {entries.length === 200 && <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 10 }}>Showing the most recent 200 entries.</p>}
        </>
      )}
    </div>
  );
}
