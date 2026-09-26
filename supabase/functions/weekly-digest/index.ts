// weekly-digest: the staff weekly digest email.
//
// Deploy: this file plus copies of src/lib/weeklyDigest.js, scheduling.js,
// birthdays.js, quietChurn.js, attendance.js and dates.js, all side by side
// (the digest content lives in src/lib/weeklyDigest.js — one source, unit
// tested). verify_jwt is off: callers are checked below.
//
// Three ways in:
//  - pg_cron, hourly, with x-webhook-secret: sends when it's the configured
//    Sydney day + hour (Admin Config → Weekly digest, default Friday 8pm),
//    the digest is switched on, and it hasn't already gone out today. Goes to
//    the studio email plus the chosen team members, one email each.
//  - An admin, { action: "test", sections }: "Send a test now". Goes ONLY to
//    the studio email, whatever the recipient list says, with a [Test]
//    subject and a banner saying so. Works while the digest is switched off.
//    The email itself never mentions Admin Config, the recipient list or who
//    asked for the test (team members who aren't admins can receive it).
//  - An admin, { action: "info" }: the studio email and the scheduled
//    recipients' emails, for the Admin Config screen.
// Never emails parents. Every send is logged to email_log (History) and
// scheduled_runs.

import { loadDigestData, buildDigest, isDigestDue, DEFAULT_DIGEST_DAY, DEFAULT_DIGEST_HOUR } from "./weeklyDigest.js";
import { localDateStr } from "./dates.js";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET");
const FROM_ADDRESS = Deno.env.get("NOTIFY_FROM_ADDRESS") || "Nritya Mandala <noreply@mail.nrityamandala.com>";
const REPLY_TO = Deno.env.get("REPLY_TO_ADDRESS") || "nrityamandala93@gmail.com";
const STUDIO_EMAIL = Deno.env.get("STUDIO_NOTIFY_EMAIL") || "nrityamandala93@gmail.com";
const ADMIN_ORIGIN = Deno.env.get("ADMIN_ORIGIN") || "https://admin.nrityamandala.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RUN_NAME = "weekly_digest";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const serviceHeaders = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

async function sbGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: serviceHeaders });
  if (!res.ok) throw new Error(`GET ${path.split("?")[0]} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbWrite(method: string, path: string, body: unknown, returnRows = false) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { ...serviceHeaders, "Content-Type": "application/json", Prefer: returnRows ? "return=representation" : "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!res.ok) { console.error(method, path, res.status, await res.text()); return null; }
  return returnRows ? res.json() : null;
}

async function sbRpc(name: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST", headers: { ...serviceHeaders, "Content-Type": "application/json" }, body: "{}" });
  if (!res.ok) return 0;
  const n = await res.json();
  return typeof n === "number" ? n : 0;
}

// The signed-in caller, if they're an admin: their email; otherwise null.
async function adminCaller(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_ROLE_KEY, Authorization: authHeader } });
  if (!res.ok) return null;
  const user = await res.json();
  if (!user?.id) return null;
  const rows = await sbGet(`admin_users?id=eq.${user.id}&select=is_admin`);
  return rows[0]?.is_admin ? (user.email || "an admin") : null;
}

async function loadSettings() {
  const rows = await sbGet("admin_settings?id=eq.1&select=weekly_digest_enabled,weekly_digest_day,weekly_digest_hour,weekly_digest_recipient_ids,weekly_digest_sections,weekly_digest_last_sent_on,resend_daily_limit,resend_monthly_limit");
  return rows[0] || {};
}

// Chosen team members' emails (anyone since removed from the team is dropped).
async function recipientEmails(ids: string[] | null): Promise<string[]> {
  if (!ids || ids.length === 0) return [];
  const rows = await sbGet(`admin_users?id=in.(${ids.join(",")})&select=email`);
  return rows.map((r: { email: string | null }) => r.email).filter(Boolean);
}

function uniqueEmails(list: string[]) {
  const seen = new Set<string>();
  return list.filter((e) => {
    const key = e.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html, reply_to: REPLY_TO }),
  });
  if (!res.ok) console.error("Resend error", res.status, await res.text());
  return res.ok;
}

async function createRun(status: string, checked: number, sent: number, error: string | null = null) {
  const rows = await sbWrite("POST", "scheduled_runs", { run_name: RUN_NAME, status, checked_count: checked, sent_count: sent, error_message: error }, true);
  return rows?.[0]?.id as string | undefined;
}

// Builds and sends to each recipient, logs everything. Returns a summary.
async function sendDigest({ recipients, test, triggeredBy, sections, settings }: {
  recipients: string[]; test: boolean; triggeredBy: string; sections: unknown; settings: Record<string, any>;
}) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");
  const [dayCount, monthCount] = await Promise.all([sbRpc("get_email_count_today"), sbRpc("get_email_count_this_month")]);
  if (dayCount + recipients.length > (settings.resend_daily_limit ?? 100) || monthCount + recipients.length > (settings.resend_monthly_limit ?? 3000)) {
    const runId = await createRun("error", recipients.length, 0, "Email budget reached (Admin Config → Data) — digest not sent.");
    return { ok: false, error: "Email budget reached — digest not sent.", runId };
  }
  const todayStr = localDateStr(new Date());
  const data = await loadDigestData(sbGet, todayStr);
  const { subject, html } = buildDigest(data, { todayStr, sections, test, adminOrigin: ADMIN_ORIGIN });

  const logRows: Record<string, unknown>[] = [];
  let sent = 0;
  for (const to of recipients) {
    const ok = await sendEmail(to, subject, html);
    if (ok) sent++;
    logRows.push({ triggered_by: triggeredBy, student_id: null, student_name: null, recipient_email: to, recipient_role: "to", subject, body: html, email_type: test ? "weekly_digest_test" : "weekly_digest", success: ok });
  }
  const status = sent === 0 ? "error" : test ? "test" : "completed";
  const runId = await createRun(status, recipients.length, sent, sent < recipients.length ? `${recipients.length - sent} of ${recipients.length} failed to send` : null);
  await sbWrite("POST", "email_log", logRows.map((r) => ({ ...r, scheduled_run_id: runId ?? null })));
  return { ok: sent > 0, sent, recipients, subject, runId };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    // Scheduled (pg_cron).
    if (WEBHOOK_SECRET && req.headers.get("x-webhook-secret") === WEBHOOK_SECRET) {
      const settings = await loadSettings();
      if (!settings.weekly_digest_enabled) return json({ ok: true, skipped: "switched_off" });
      const due = isDigestDue({
        day: settings.weekly_digest_day || DEFAULT_DIGEST_DAY,
        hour: settings.weekly_digest_hour ?? DEFAULT_DIGEST_HOUR,
        lastSentOn: settings.weekly_digest_last_sent_on,
      });
      if (!due) return json({ ok: true, skipped: "not_due" });
      // Mark first, so an overlapping run can't send it twice.
      await sbWrite("PATCH", "admin_settings?id=eq.1", { weekly_digest_last_sent_on: localDateStr(new Date()) });
      const recipients = uniqueEmails([STUDIO_EMAIL, ...(await recipientEmails(settings.weekly_digest_recipient_ids))]);
      const result = await sendDigest({ recipients, test: false, triggeredBy: "system (weekly digest)", sections: settings.weekly_digest_sections, settings });
      return json(result);
    }

    // Admin actions from Admin Config.
    const caller = await adminCaller(req.headers.get("Authorization"));
    if (!caller) return json({ ok: false, error: "unauthorized" }, 401);
    const body = await req.json().catch(() => ({}));
    const settings = await loadSettings();

    if (body.action === "info") {
      return json({ ok: true, studioEmail: STUDIO_EMAIL, scheduledRecipients: await recipientEmails(settings.weekly_digest_recipient_ids) });
    }
    if (body.action === "test") {
      // Test sends only ever go to the studio email.
      const sections = body.sections && typeof body.sections === "object" ? body.sections : settings.weekly_digest_sections;
      const result = await sendDigest({
        recipients: [STUDIO_EMAIL],
        test: true,
        triggeredBy: caller,
        sections,
        settings,
      });
      return json({ ...result, studioEmail: STUDIO_EMAIL }, result.ok ? 200 : 500);
    }
    return json({ ok: false, error: "unknown action" }, 400);
  } catch (err) {
    console.error(err);
    await createRun("error", 0, 0, String(err));
    return json({ ok: false, error: String(err) }, 500);
  }
});
