import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { Btn, Select } from "./ui";
import { formatSydneyDateTime, formatSydneyDate } from "../lib/dates";
import { ALL_PERMISSIONS } from "../lib/permissions";
import { DIGEST_SECTIONS, WEEKDAY_NAMES, DEFAULT_DIGEST_DAY, DEFAULT_DIGEST_HOUR, isSectionOn, formatHour } from "../lib/weeklyDigest";

// Admin Config → Weekly digest: the staff summary email (src/lib/weeklyDigest.js
// builds it; the weekly-digest edge function sends it). Admin-only, like the
// rest of Admin Config. Recipients are picked by user, so they can later be
// chosen by role; the studio email always gets it. "Send a test now" only
// ever goes to the studio email — the edge function enforces that too.

const PERMISSION_LABEL = Object.fromEntries(ALL_PERMISSIONS.map((p) => [p.key, p.label]));
const HOURS = Array.from({ length: 24 }, (_, h) => h);

const card = { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18, marginBottom: 16 };
const h3 = { fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 };
const note = { fontSize: 12, color: T.inkSoft, lineHeight: 1.5 };
const subhead = { fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 6 };

// supabase.functions.invoke puts a non-2xx body on error.context.
async function invokeDigest(body) {
  const { data, error } = await supabase.functions.invoke("weekly-digest", { body });
  if (!error) return data;
  try {
    return await error.context.json();
  } catch {
    return { ok: false, error: error.message || "Couldn't reach the digest service." };
  }
}

function roleLabel(user, perms) {
  if (user.is_admin) return "Admin";
  const labels = [...(perms || [])].map((p) => PERMISSION_LABEL[p] || p);
  return labels.length ? labels.join(", ") : "No permissions";
}

function DigestRunsLog({ refreshKey }) {
  const [runs, setRuns] = useState(null);

  useEffect(() => {
    supabase.from("scheduled_runs").select("*").eq("run_name", "weekly_digest").order("run_at", { ascending: false }).limit(10)
      .then(({ data }) => setRuns(data || []));
  }, [refreshKey]);

  return (
    <div style={card}>
      <h3 style={h3}>Digest log</h3>
      {runs === null ? (
        <p style={note}>Loading…</p>
      ) : runs.length === 0 ? (
        <p style={note}>Nothing sent yet — scheduled sends and test sends will appear here (and in History → Emails).</p>
      ) : (
        <div className="grid gap-2">
          {runs.map((r) => (
            <div key={r.id} style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 12px" }}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{formatSydneyDateTime(r.run_at)}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, marginLeft: 8, textTransform: "uppercase", letterSpacing: 0.3,
                    color: r.status === "error" ? T.terracotta : r.status === "test" ? T.gold : T.sage,
                  }}>
                    {r.status === "completed" ? "sent" : r.status === "test" ? "test" : r.status}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: T.inkSoft }}>{r.sent_count} of {r.checked_count} sent</span>
              </div>
              {r.error_message && <p style={{ fontSize: 12, color: T.terracotta, marginTop: 4 }}>{r.error_message}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WeeklyDigestConfig() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [day, setDay] = useState(DEFAULT_DIGEST_DAY);
  const [hour, setHour] = useState(DEFAULT_DIGEST_HOUR);
  const [recipientIds, setRecipientIds] = useState([]);
  const [sections, setSections] = useState({});
  const [lastSentOn, setLastSentOn] = useState(null);
  const [team, setTeam] = useState([]); // [{ id, email, is_admin, name, role }]
  const [studioEmail, setStudioEmail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok, message }
  const [logKey, setLogKey] = useState(0);

  useEffect(() => {
    Promise.all([
      supabase.from("admin_settings").select("weekly_digest_enabled, weekly_digest_day, weekly_digest_hour, weekly_digest_recipient_ids, weekly_digest_sections, weekly_digest_last_sent_on").eq("id", 1).maybeSingle(),
      supabase.from("admin_users").select("id, email, is_admin").order("email"),
      supabase.from("user_permissions").select("user_id, permission"),
      supabase.rpc("list_admin_users"),
      invokeDigest({ action: "info" }),
    ]).then(([settingsRes, usersRes, permsRes, namesRes, info]) => {
      const s = settingsRes.data;
      if (s) {
        setEnabled(!!s.weekly_digest_enabled);
        setDay(s.weekly_digest_day || DEFAULT_DIGEST_DAY);
        setHour(s.weekly_digest_hour ?? DEFAULT_DIGEST_HOUR);
        setRecipientIds(s.weekly_digest_recipient_ids || []);
        setSections(s.weekly_digest_sections || {});
        setLastSentOn(s.weekly_digest_last_sent_on);
      }
      const permsByUser = {};
      (permsRes.data || []).forEach((p) => (permsByUser[p.user_id] ||= new Set()).add(p.permission));
      const names = Object.fromEntries((namesRes.data || []).map((r) => [r.id, r.display_name || ""]));
      setTeam((usersRes.data || []).map((u) => ({ ...u, name: names[u.id] || "", role: roleLabel(u, permsByUser[u.id]) })));
      setStudioEmail(info?.studioEmail || null);
      setLoading(false);
    });
  }, []);

  const toggleRecipient = (id, checked) => {
    setRecipientIds((ids) => (checked ? [...new Set([...ids, id])] : ids.filter((x) => x !== id)));
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError("");
    const { error } = await supabase.from("admin_settings").update({
      weekly_digest_enabled: enabled,
      weekly_digest_day: day,
      weekly_digest_hour: Number(hour),
      // Only people still on the team.
      weekly_digest_recipient_ids: recipientIds.filter((id) => team.some((u) => u.id === id)),
      weekly_digest_sections: sections,
    }).eq("id", 1);
    setSaving(false);
    if (error) { setSaveError("Couldn't save — please try again."); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const sendTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await invokeDigest({ action: "test", sections });
    setTesting(false);
    setTestResult(res?.ok
      ? { ok: true, message: `Test sent to the studio email (${res.studioEmail || studioEmail}).` }
      : { ok: false, message: res?.error || "The test didn't send." });
    setLogKey((k) => k + 1);
  };

  if (loading) return <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>;

  const studioLabel = studioEmail || "the studio email";

  return (
    <>
      <div style={card}>
        <h3 style={h3}>Weekly digest</h3>
        <p style={{ ...note, marginBottom: 14 }}>
          A summary email for the team: the week ahead (classes, who's away, cancellations, announcements), birthdays with the class to wish them at, what needs attention, last week's recap, forms and unread messages. No money figures, and never sent to parents.
        </p>

        <label className="flex items-center gap-2 mb-3" style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Send the weekly digest automatically
        </label>

        <div className="flex items-center gap-2 flex-wrap mb-1" style={{ fontSize: 13, color: T.ink }}>
          <span>Every</span>
          <div style={{ width: 150 }}>
            <Select value={day} onChange={(e) => setDay(e.target.value)}>
              {WEEKDAY_NAMES.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </div>
          <span>at</span>
          <div style={{ width: 110 }}>
            <Select value={hour} onChange={(e) => setHour(Number(e.target.value))}>
              {HOURS.map((h) => <option key={h} value={h}>{formatHour(h)}</option>)}
            </Select>
          </div>
          <span>Sydney time</span>
        </div>
        <p style={{ ...note, marginBottom: 16 }}>
          {lastSentOn ? `Last scheduled send: ${formatSydneyDate(lastSentOn + "T12:00:00")}.` : "Not sent on a schedule yet."}
        </p>

        <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 14, marginBottom: 16 }}>
          <div style={subhead}>Who gets it</div>
          <label className="flex items-center gap-2 mb-2" style={{ fontSize: 13, color: T.ink }}>
            <input type="checkbox" checked disabled />
            <span>Studio email{studioEmail ? <> — <strong>{studioEmail}</strong></> : ""} <span style={{ color: T.inkSoft }}>(always)</span></span>
          </label>
          {team.length === 0 ? (
            <p style={note}>No team members yet.</p>
          ) : team.map((u) => (
            <label key={u.id} className="flex items-start gap-2 mb-2" style={{ fontSize: 13, color: T.ink }}>
              <input type="checkbox" style={{ marginTop: 3 }} checked={recipientIds.includes(u.id)} onChange={(e) => toggleRecipient(u.id, e.target.checked)} />
              <span>
                {u.name ? <><strong>{u.name}</strong> — {u.email}</> : u.email}
                <span style={{ display: "block", fontSize: 11, color: T.inkSoft }}>{u.role}</span>
              </span>
            </label>
          ))}
          <p style={note}>Each person gets their own copy. Picked by person, so it can later be sent by role.</p>
        </div>

        <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 14, marginBottom: 16 }}>
          <div style={subhead}>What's in it</div>
          {DIGEST_SECTIONS.map((s) => (
            <label key={s.key} className="flex items-start gap-2 mb-2" style={{ fontSize: 13, color: T.ink }}>
              <input type="checkbox" style={{ marginTop: 3 }} checked={isSectionOn(sections, s.key)} onChange={(e) => setSections((prev) => ({ ...prev, [s.key]: e.target.checked }))} />
              <span>
                <strong>{s.label}</strong>
                <span style={{ display: "block", fontSize: 11, color: T.inkSoft }}>{s.description}</span>
              </span>
            </label>
          ))}
        </div>

        {saved && <p style={{ color: T.sage, fontSize: 13, marginBottom: 10, fontWeight: 600 }}>Saved.</p>}
        {saveError && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 10, fontWeight: 600 }}>{saveError}</p>}
        <Btn variant="success" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
      </div>

      <div style={card}>
        <h3 style={h3}>Send a test now</h3>
        <p style={{ ...note, marginBottom: 12 }}>
          Sends this week's digest right now <strong style={{ color: T.ink }}>only to the studio email ({studioLabel})</strong> — never to the team members ticked above. It's marked <strong style={{ color: T.ink }}>[Test]</strong> in the subject and says so at the top. Uses the sections ticked above, even before you save. Works whether or not automatic sending is on.
        </p>
        <Btn variant="gold" onClick={sendTest} disabled={testing}>{testing ? "Sending…" : `Send a test to ${studioLabel}`}</Btn>
        {testResult && (
          <p style={{ fontSize: 13, fontWeight: 600, marginTop: 10, color: testResult.ok ? T.sage : T.terracotta }}>{testResult.message}</p>
        )}
      </div>

      <DigestRunsLog refreshKey={logKey} />
    </>
  );
}
