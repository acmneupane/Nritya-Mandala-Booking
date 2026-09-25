import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, ConfirmModal, Field, Modal, Select, TypeToConfirmModal } from "./ui";
import FormBuilder from "./FormBuilder";
import FormResponses from "./FormResponses";
import FormShareModal from "./FormShareModal";
import { STATUS_INFO, effectiveStatus, codeFromTitle, formLink } from "../lib/forms";
import { formatSydneyDate } from "../lib/dates";

// Admin → Forms: interest / survey forms with a public link
// (/forms?code=CODE). The list shows every form with its status and new
// responses; opening one shows its Build and Responses tabs.
// Visible to anyone with the Studio Settings permission (and admins).

const DEFAULT_THANK_YOU = "<p>Thank you for your response! We'll be in touch soon. 🙏</p>";

// A code not used by any other form: BASE, BASE2, BASE3…
async function uniqueFormCode(base) {
  const { data } = await supabase.from("forms").select("code").like("code", `${base}%`);
  const taken = new Set((data || []).map((r) => r.code));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const code = `${base.slice(0, 24 - String(i).length)}${i}`;
    if (!taken.has(code)) return code;
  }
  return `${base.slice(0, 18)}${Date.now().toString().slice(-6)}`;
}

function StatusBadge({ form, withExplanation = false }) {
  const status = effectiveStatus(form);
  const info = STATUS_INFO[status];
  const autoClosed = status === "closed" && form.status === "open";
  return (
    <div>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: info.color, background: `${info.color}18`, border: `1px solid ${info.color}44`, borderRadius: 999, padding: "2px 10px" }}>
        {info.dot} {info.label}{autoClosed ? " (close date passed)" : ""}
      </span>
      {withExplanation && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>{info.explain}</div>}
    </div>
  );
}

function NewFormModal({ existingTags, onCancel, onCreated }) {
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    if (!title.trim()) { setError("Give the form a title."); return; }
    setSaving(true);
    const code = await uniqueFormCode(codeFromTitle(title));
    const { data, error: err } = await supabase.from("forms")
      .insert({ title: title.trim(), internal_tag: tag.trim() || null, code, thank_you_html: DEFAULT_THANK_YOU })
      .select("id").single();
    setSaving(false);
    if (err) { setError(err.message); return; }
    onCreated(data.id);
  };

  return (
    <Modal title="New form" onClose={onCancel}>
      <Field label="Title"><input style={inputStyle} value={title} onChange={(e) => { setTitle(e.target.value); setError(""); }} placeholder="e.g. Adult Bollywood classes" autoFocus /></Field>
      <Field label="Internal tag (optional)">
        <input style={inputStyle} value={tag} onChange={(e) => setTag(e.target.value)} list="new-form-tags" placeholder="e.g. Adults" />
        <datalist id="new-form-tags">{existingTags.map((t) => <option key={t} value={t} />)}</datalist>
      </Field>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 12 }}>
        Code: <strong style={{ fontFamily: "monospace" }}>{codeFromTitle(title) || "—"}</strong> (from the title — you can change it while the form is a Draft).
      </p>
      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 10 }}>{error}</p>}
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="success" onClick={create} disabled={saving}>{saving ? "Creating…" : "Create form"}</Btn>
      </div>
    </Modal>
  );
}

function FormDetail({ formId, existingTags, onBack, onChanged }) {
  const [form, setForm] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [counts, setCounts] = useState({ total: 0, fresh: 0 });
  const [tab, setTab] = useState("build");
  const [version, setVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [pendingNav, setPendingNav] = useState(null); // a function to run once unsaved changes are discarded
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [fRes, qRes, rRes] = await Promise.all([
      supabase.from("forms").select("*").eq("id", formId).maybeSingle(),
      supabase.from("form_questions").select("*").eq("form_id", formId).order("position"),
      supabase.from("form_responses").select("status").eq("form_id", formId),
    ]);
    setForm(fRes.data || null);
    setQuestions(qRes.data || []);
    const rows = rRes.data || [];
    setCounts({ total: rows.length, fresh: rows.filter((r) => r.status === "new").length });
    setVersion((v) => v + 1);
  }, [formId]);

  useEffect(() => { load(); }, [load]);

  const guard = (fn) => () => (dirty ? setPendingNav(() => fn) : fn());

  const setStatus = async (status) => {
    setError("");
    const { error: err } = await supabase.from("forms").update({ status }).eq("id", formId);
    if (err) { setError(err.message); return; }
    await load();
    onChanged();
  };

  if (!form) {
    return (
      <div>
        <button onClick={onBack} style={{ fontSize: 13, color: T.maroon, fontWeight: 600, marginBottom: 12 }}>‹ All forms</button>
        <p style={{ fontSize: 13, color: T.inkSoft }}>{form === null && version > 0 ? "This form no longer exists." : "Loading…"}</p>
      </div>
    );
  }

  const status = effectiveStatus(form);

  return (
    <div>
      <button onClick={guard(onBack)} style={{ fontSize: 13, color: T.maroon, fontWeight: 600, marginBottom: 12 }}>‹ All forms</button>

      <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.maroonDark, lineHeight: 1.25 }}>{form.title}</h2>
            <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
              <span style={{ fontFamily: "monospace" }}>{form.code}</span>
              {form.internal_tag && <> · 🏷 {form.internal_tag}</>}
              {form.closes_on && <> · closes after {formatSydneyDate(`${form.closes_on}T12:00:00`)}</>}
            </div>
            <div style={{ marginTop: 8 }}><StatusBadge form={form} withExplanation /></div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {status === "open" && <Btn size="sm" variant="ghost" onClick={() => setSharing(true)}>🔗 Share</Btn>}
            {status === "draft" && <Btn size="sm" onClick={guard(() => setConfirmOpen(true))}>Open form</Btn>}
            {status === "open" && <Btn size="sm" variant="danger" onClick={guard(() => setStatus("closed"))}>Close form</Btn>}
            {status === "closed" && (
              form.status === "open"
                ? <span style={{ fontSize: 12, color: T.inkSoft, maxWidth: 220 }}>To reopen, clear or move the close date in Build → Settings.</span>
                : <Btn size="sm" onClick={guard(() => setStatus("open"))}>Reopen</Btn>
            )}
          </div>
        </div>
        {error && <p style={{ color: T.terracotta, fontSize: 13, marginTop: 10 }}>{error}</p>}
      </div>

      <div className="inline-flex" style={{ background: T.paper, borderRadius: 8, padding: 3, marginBottom: 14 }}>
        {[["build", "Build"], ["responses", `Responses (${counts.total})`]].map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={k === tab ? undefined : guard(() => setTab(k))}
            style={{ fontSize: 13, fontWeight: 600, padding: "6px 16px", borderRadius: 6, background: tab === k ? "#fff" : "transparent", color: tab === k ? T.maroonDark : T.inkSoft }}
          >
            {label}
            {k === "responses" && counts.fresh > 0 && (
              <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, background: T.terracotta, color: "#fff", borderRadius: 999, padding: "1px 7px" }}>{counts.fresh} new</span>
            )}
          </button>
        ))}
      </div>
      {justSaved && <span style={{ marginLeft: 12, fontSize: 13, color: T.sage, fontWeight: 600 }}>Saved ✓</span>}

      {tab === "build" ? (
        <FormBuilder
          key={version}
          form={form}
          questions={questions}
          hasResponses={counts.total > 0}
          existingTags={existingTags}
          onSaved={async () => { await load(); onChanged(); setJustSaved(true); setTimeout(() => setJustSaved(false), 2500); }}
          onDirtyChange={setDirty}
        />
      ) : (
        <FormResponses form={form} questions={questions} onCountsChange={async () => { await load(); onChanged(); }} />
      )}

      {confirmOpen && (
        <ConfirmModal
          title="Open this form?"
          message={<>The link goes live and starts accepting responses. <strong>The code ({form.code}) will be locked</strong>, and the form can't go back to Draft — you can close it at any time.</>}
          confirmLabel="Open form"
          onConfirm={() => { setConfirmOpen(false); setStatus("open"); }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
      {pendingNav && (
        <ConfirmModal
          title="Discard unsaved changes?"
          message="You have changes in Build that haven't been saved."
          confirmLabel="Discard changes"
          onConfirm={() => { const fn = pendingNav; setPendingNav(null); setDirty(false); setVersion((v) => v + 1); fn(); }}
          onCancel={() => setPendingNav(null)}
        />
      )}
      {sharing && <FormShareModal form={form} onClose={() => setSharing(false)} />}
    </div>
  );
}

export default function FormsView({ focusFormId }) {
  const [forms, setForms] = useState(null);
  const [counts, setCounts] = useState({}); // form id -> { total, fresh }
  const [selectedId, setSelectedId] = useState(focusFormId || null);
  const [tagFilter, setTagFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [sharing, setSharing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [fRes, rRes] = await Promise.all([
      supabase.from("forms").select("*").order("created_at", { ascending: false }),
      supabase.from("form_responses").select("form_id, status"),
    ]);
    if (fRes.error) setError(fRes.error.message);
    setForms(fRes.data || []);
    const next = {};
    for (const r of rRes.data || []) {
      next[r.form_id] ||= { total: 0, fresh: 0 };
      next[r.form_id].total++;
      if (r.status === "new") next[r.form_id].fresh++;
    }
    setCounts(next);
  }, []);

  useEffect(() => { load(); }, [load]);

  const existingTags = useMemo(
    () => [...new Set((forms || []).map((f) => f.internal_tag).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [forms],
  );

  const duplicate = async (form) => {
    setError("");
    const { data: qs } = await supabase.from("form_questions").select("*").eq("form_id", form.id).eq("archived", false).order("position");
    const code = await uniqueFormCode(codeFromTitle(`${form.title}COPY`));
    const { data: created, error: err } = await supabase.from("forms").insert({
      title: `${form.title} (copy)`,
      internal_tag: form.internal_tag,
      code,
      intro_html: form.intro_html,
      thank_you_html: form.thank_you_html,
      contact_name_mode: form.contact_name_mode,
      contact_email_mode: form.contact_email_mode,
      contact_phone_mode: form.contact_phone_mode,
      notify_on_response: form.notify_on_response,
    }).select("id").single();
    if (err) { setError(err.message); return; }
    if (qs?.length) {
      const { error: qErr } = await supabase.from("form_questions").insert(qs.map((q, i) => ({
        form_id: created.id, position: i, type: q.type, label: q.label, help_text: q.help_text, required: q.required,
        options: (q.options || []).filter((o) => !o.archived),
      })));
      if (qErr) { setError(qErr.message); return; }
    }
    await load();
    setSelectedId(created.id);
  };

  const remove = async () => {
    const form = deleting;
    setDeleting(null);
    const { error: err } = await supabase.from("forms").delete().eq("id", form.id);
    if (err) { setError(err.message); return; }
    load();
  };

  const copyLink = async (form) => {
    try {
      await navigator.clipboard.writeText(formLink(form.code));
      setCopiedId(form.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setSharing(form);
    }
  };

  if (selectedId) {
    return (
      <FormDetail
        formId={selectedId}
        existingTags={existingTags}
        onBack={() => { setSelectedId(null); load(); }}
        onChanged={load}
      />
    );
  }

  const visible = (forms || []).filter((f) => !tagFilter || f.internal_tag === tagFilter);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginBottom: 6 }}>
        <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: T.maroonDark }}>Forms</h2>
        <Btn onClick={() => setCreating(true)}>+ New form</Btn>
      </div>
      <p style={{ fontSize: 13, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        Interest and survey forms with their own public link. ⚪ Draft = not live yet · 🟢 Open = accepting responses · 🟠 Closed = link shows “no longer accepting responses”.
      </p>

      {existingTags.length > 0 && (
        <div style={{ maxWidth: 240, marginBottom: 14 }}>
          <Select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} style={{ padding: "7px 34px 7px 10px", fontSize: 13 }}>
            <option value="">All tags</option>
            {existingTags.map((t) => <option key={t} value={t}>🏷 {t}</option>)}
          </Select>
        </div>
      )}

      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 10 }}>{error}</p>}

      {forms === null ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>
      ) : visible.length === 0 ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>{forms.length === 0 ? "No forms yet — create your first one." : "No forms with this tag."}</p>
      ) : (
        <div className="grid gap-3">
          {visible.map((f) => {
            const c = counts[f.id] || { total: 0, fresh: 0 };
            return (
              <div key={f.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 14 }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <button type="button" onClick={() => setSelectedId(f.id)} style={{ textAlign: "left", minWidth: 0 }}>
                    <div style={{ fontFamily: "Fraunces, serif", fontSize: 17, fontWeight: 600, color: T.maroonDark }}>{f.title}</div>
                    <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                      <span style={{ fontFamily: "monospace" }}>{f.code}</span>
                      {f.internal_tag && <> · 🏷 {f.internal_tag}</>}
                      {f.closes_on && <> · closes after {formatSydneyDate(`${f.closes_on}T12:00:00`)}</>}
                    </div>
                  </button>
                  <StatusBadge form={f} />
                </div>
                <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 10 }}>
                  <span style={{ fontSize: 12.5, color: T.ink }}>
                    {c.total} response{c.total === 1 ? "" : "s"}
                    {c.fresh > 0 && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, background: T.terracotta, color: "#fff", borderRadius: 999, padding: "1px 7px" }}>{c.fresh} new</span>}
                  </span>
                  <div className="flex gap-2 flex-wrap ml-auto">
                    <Btn size="sm" onClick={() => setSelectedId(f.id)}>Manage</Btn>
                    {effectiveStatus(f) === "open" ? (
                      <>
                        <Btn size="sm" variant="ghost" onClick={() => copyLink(f)}>{copiedId === f.id ? "Copied ✓" : "Copy link"}</Btn>
                        <Btn size="sm" variant="ghost" onClick={() => setSharing(f)}>🔗 Share</Btn>
                      </>
                    ) : (
                      <span style={{ fontSize: 12, color: T.inkSoft, alignSelf: "center" }}>
                        {effectiveStatus(f) === "draft" ? "Open the form to share its link" : "Reopen to share its link"}
                      </span>
                    )}
                    <Btn size="sm" variant="ghost" onClick={() => duplicate(f)}>⧉ Duplicate</Btn>
                    <Btn size="sm" variant="danger" onClick={() => setDeleting(f)}>Delete</Btn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating && (
        <NewFormModal
          existingTags={existingTags}
          onCancel={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); load(); setSelectedId(id); }}
        />
      )}
      {sharing && <FormShareModal form={sharing} onClose={() => setSharing(null)} />}
      {deleting && ((counts[deleting.id]?.total || 0) > 0 ? (
        <TypeToConfirmModal
          title="Delete this form and its responses?"
          message={`“${deleting.title}” has ${counts[deleting.id].total} response${counts[deleting.id].total === 1 ? "" : "s"}. Deleting the form deletes them too, and can't be undone. To just stop new responses, close the form instead.`}
          confirmString={deleting.code}
          confirmLabel="Delete form"
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      ) : (
        <ConfirmModal
          title="Delete this form?"
          message={`Delete “${deleting.title}”? It has no responses. This can't be undone.`}
          confirmLabel="Delete form"
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      ))}
    </div>
  );
}
