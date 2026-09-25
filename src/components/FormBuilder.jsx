import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Field, RichTextEditor, Select } from "./ui";
import FormRenderer from "./FormRenderer";
import {
  QUESTION_TYPES, CONTACT_MODES, questionTypeLabel, typeHasOptions, defaultOptions, newOptionId, cleanCode,
} from "../lib/forms";

// The "Build" tab of a form (Admin → Forms): details, messages, questions,
// contact details and settings. Edits stay local until "Save changes".
//
// Once a form has responses, saving never loses what older answers point at:
// removed questions are archived (hidden, kept), removed choice options are
// kept with archived: true, and a saved question's type can't change.

const SECTION = { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 18, marginBottom: 16 };
const H3 = { fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 4 };
const HINT = { fontSize: 12, color: T.inkSoft, marginBottom: 12, lineHeight: 1.5 };

const EDITABLE_FIELDS = [
  "title", "internal_tag", "code", "intro_html", "thank_you_html",
  "contact_name_mode", "contact_email_mode", "contact_phone_mode",
  "closes_on", "notify_on_response",
];

function pickFields(form) {
  const out = {};
  for (const k of EDITABLE_FIELDS) out[k] = form[k] ?? (typeof form[k] === "boolean" ? false : "");
  out.internal_tag = form.internal_tag || "";
  out.closes_on = form.closes_on || "";
  return out;
}

function toLocalQuestions(questions) {
  return questions
    .filter((q) => !q.archived)
    .sort((a, b) => a.position - b.position)
    .map((q) => ({ ...q, key: q.id, isNew: false, options: Array.isArray(q.options) ? q.options : [] }));
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex" style={{ background: T.paper, borderRadius: 8, padding: 3, gap: 2 }}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          style={{
            fontSize: 12.5, fontWeight: 600, padding: "5px 12px", borderRadius: 6,
            background: value === o.key ? "#fff" : "transparent",
            color: value === o.key ? T.maroonDark : T.inkSoft,
            boxShadow: value === o.key ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function IconBtn({ title, onClick, disabled, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      style={{ fontSize: 13, padding: "3px 8px", borderRadius: 6, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, opacity: disabled ? 0.35 : 1 }}
    >
      {children}
    </button>
  );
}

function QuestionCard({ q, index, count, lockedType, onChange, onMove, onDuplicate, onRemove }) {
  const visibleOptions = q.options.filter((o) => !o.archived);
  const setOption = (id, label) => onChange({ options: q.options.map((o) => (o.id === id ? { ...o, label } : o)) });
  const removeOption = (id) => onChange({
    options: lockedType
      ? q.options.map((o) => (o.id === id ? { ...o, archived: true } : o)) // keep it for older answers
      : q.options.filter((o) => o.id !== id),
  });
  const addOption = () => onChange({ options: [...q.options, { id: newOptionId(), label: "" }] });
  const changeType = (type) => {
    const keepOptions = typeHasOptions(type) && typeHasOptions(q.type) && type !== "day_time" && q.type !== "day_time";
    onChange({ type, options: keepOptions ? q.options : defaultOptions(type) });
  };

  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 14, marginBottom: 12, background: "#fff" }}>
      <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.gold }}>Q{index + 1}</span>
        <div style={{ minWidth: 200 }}>
          {lockedType ? (
            <span style={{ fontSize: 12.5, color: T.inkSoft }} title="The type can't change once the form has responses — add a new question instead.">
              {questionTypeLabel(q.type)} 🔒
            </span>
          ) : (
            <Select value={q.type} onChange={(e) => changeType(e.target.value)} style={{ padding: "6px 34px 6px 10px", fontSize: 13 }}>
              {QUESTION_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </Select>
          )}
        </div>
        <div className="flex gap-1 ml-auto">
          <IconBtn title="Move up" onClick={() => onMove(-1)} disabled={index === 0}>↑</IconBtn>
          <IconBtn title="Move down" onClick={() => onMove(1)} disabled={index === count - 1}>↓</IconBtn>
          <IconBtn title="Duplicate question" onClick={onDuplicate}>⧉</IconBtn>
          <IconBtn title="Remove question" onClick={onRemove}>🗑</IconBtn>
        </div>
      </div>
      <input style={{ ...inputStyle, fontWeight: 600, marginBottom: 8 }} value={q.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="Question" />
      <input style={{ ...inputStyle, fontSize: 13, marginBottom: 8 }} value={q.help_text || ""} onChange={(e) => onChange({ help_text: e.target.value })} placeholder="Helper text (optional)" />

      {typeHasOptions(q.type) && (
        <div style={{ marginTop: 4, marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 6 }}>
            {q.type === "day_time" ? "Time slots (shown as columns, with Mon–Sun as rows)" : "Options"}
          </div>
          {visibleOptions.map((o) => (
            <div key={o.id} className="flex gap-2 items-center" style={{ marginBottom: 6 }}>
              <span style={{ color: T.inkSoft, fontSize: 12, width: 14 }}>{q.type === "multi_choice" ? "☐" : q.type === "day_time" ? "◷" : "○"}</span>
              <input style={{ ...inputStyle, fontSize: 13 }} value={o.label} onChange={(e) => setOption(o.id, e.target.value)} placeholder="Option" />
              <IconBtn title="Remove option" onClick={() => removeOption(o.id)} disabled={visibleOptions.length <= 1}>✕</IconBtn>
            </div>
          ))}
          <button type="button" onClick={addOption} style={{ fontSize: 12.5, fontWeight: 600, color: T.maroon }}>+ Add {q.type === "day_time" ? "time slot" : "option"}</button>
        </div>
      )}

      <label className="flex items-center gap-2" style={{ fontSize: 13, color: T.ink }}>
        <input type="checkbox" checked={!!q.required} onChange={(e) => onChange({ required: e.target.checked })} />
        Required
      </label>
    </div>
  );
}

export default function FormBuilder({ form, questions, hasResponses, existingTags, onSaved, onDirtyChange }) {
  const initialFields = useMemo(() => pickFields(form), [form]);
  const initialQuestions = useMemo(() => toLocalQuestions(questions), [questions]);
  const [fields, setFields] = useState(initialFields);
  const [qs, setQs] = useState(initialQuestions);
  const [removedIds, setRemovedIds] = useState([]);
  const [newType, setNewType] = useState("short_text");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [previewing, setPreviewing] = useState(false);

  const codeLocked = !!form.opened_at;
  const dirty = JSON.stringify(fields) !== JSON.stringify(initialFields)
    || JSON.stringify(qs) !== JSON.stringify(initialQuestions)
    || removedIds.length > 0;

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  const set = (k, v) => { setFields((cur) => ({ ...cur, [k]: v })); setError(""); };
  const updateQ = (key, patch) => { setQs((cur) => cur.map((q) => (q.key === key ? { ...q, ...patch } : q))); setError(""); };
  const moveQ = (idx, dir) => setQs((cur) => {
    const next = [...cur];
    const [item] = next.splice(idx, 1);
    next.splice(idx + dir, 0, item);
    return next;
  });
  const duplicateQ = (idx) => setQs((cur) => {
    const src = cur[idx];
    const copy = {
      ...src, id: undefined, key: `new-${newOptionId()}`, isNew: true, label: `${src.label} (copy)`,
      options: src.options.filter((o) => !o.archived).map((o) => ({ ...o, id: newOptionId() })),
    };
    const next = [...cur];
    next.splice(idx + 1, 0, copy);
    return next;
  });
  const removeQ = (idx) => {
    const q = qs[idx];
    if (!q.isNew) setRemovedIds((cur) => [...cur, q.id]);
    setQs((cur) => cur.filter((_, i) => i !== idx));
  };
  const addQ = () => setQs((cur) => [...cur, {
    key: `new-${newOptionId()}`, isNew: true, type: newType, label: "", help_text: "", required: false, options: defaultOptions(newType),
  }]);

  const discard = () => { setFields(initialFields); setQs(initialQuestions); setRemovedIds([]); setError(""); };

  const validate = () => {
    if (!fields.title.trim()) return "Give the form a title.";
    const code = cleanCode(fields.code);
    if (!codeLocked && (code.length < 3 || code.length > 24)) return "The code needs 3–24 letters or numbers.";
    for (const [i, q] of qs.entries()) {
      if (!q.label.trim()) return `Question ${i + 1} needs a question.`;
      if (typeHasOptions(q.type)) {
        const opts = q.options.filter((o) => !o.archived);
        if (opts.length === 0) return `Question ${i + 1} needs at least one option.`;
        if (opts.some((o) => !o.label.trim())) return `Question ${i + 1} has an empty option.`;
      }
    }
    return "";
  };

  const save = async () => {
    const problem = validate();
    if (problem) { setError(problem); return; }
    setSaving(true);
    setError("");

    const payload = {
      title: fields.title.trim(),
      internal_tag: fields.internal_tag.trim() || null,
      intro_html: fields.intro_html || "",
      thank_you_html: fields.thank_you_html || "",
      contact_name_mode: fields.contact_name_mode,
      contact_email_mode: fields.contact_email_mode,
      contact_phone_mode: fields.contact_phone_mode,
      closes_on: fields.closes_on || null,
      notify_on_response: !!fields.notify_on_response,
    };
    if (!codeLocked) payload.code = cleanCode(fields.code);

    const { error: formErr } = await supabase.from("forms").update(payload).eq("id", form.id);
    if (formErr) {
      setSaving(false);
      setError(formErr.code === "23505" ? "That code is already used by another form — pick a different one." : formErr.message);
      return;
    }

    const clean = (q) => ({
      type: q.type,
      label: q.label.trim(),
      help_text: (q.help_text || "").trim() || null,
      required: !!q.required,
      options: typeHasOptions(q.type) ? q.options.map((o) => ({ ...o, label: o.label.trim() })) : [],
    });
    const inserts = [];
    const updates = [];
    qs.forEach((q, i) => {
      if (q.isNew) inserts.push({ ...clean(q), form_id: form.id, position: i });
      else updates.push(supabase.from("form_questions").update({ ...clean(q), position: i }).eq("id", q.id));
    });
    const results = await Promise.all([
      ...updates,
      inserts.length ? supabase.from("form_questions").insert(inserts) : Promise.resolve({}),
      ...removedIds.map((id) => (hasResponses
        ? supabase.from("form_questions").update({ archived: true }).eq("id", id)
        : supabase.from("form_questions").delete().eq("id", id))),
    ]);
    setSaving(false);
    const failed = results.find((r) => r?.error);
    if (failed) { setError(failed.error.message); return; }
    setRemovedIds([]);
    onSaved?.();
  };

  const previewForm = {
    ...fields,
    code: cleanCode(fields.code),
    questions: qs.map((q) => ({ ...q, id: q.key, options: q.options.filter((o) => !o.archived) })),
  };

  return (
    <div style={{ paddingBottom: dirty ? 70 : 0 }}>
      {form.status === "open" && (
        <p style={{ fontSize: 12.5, color: T.maroonDark, background: `${T.gold}1c`, border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "8px 12px", marginBottom: 14, lineHeight: 1.5 }}>
          This form is <strong>published</strong> — saved changes show to new visitors straight away.
        </p>
      )}

      <div className="flex justify-end" style={{ marginBottom: 10 }}>
        <Btn variant="ghost" size="sm" onClick={() => setPreviewing(true)}>👁 Preview</Btn>
      </div>

      <div style={SECTION}>
        <h3 style={H3}>Details</h3>
        <p style={HINT}>The title shows at the top of the form. The internal tag is just for you — use it to group and filter forms; the public never sees it.</p>
        <Field label="Title"><input style={inputStyle} value={fields.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="Internal tag (optional)">
          <input style={inputStyle} value={fields.internal_tag} onChange={(e) => set("internal_tag", e.target.value)} list="form-tags" placeholder="e.g. Adults, Holiday workshop" />
          <datalist id="form-tags">{existingTags.map((t) => <option key={t} value={t} />)}</datalist>
        </Field>
        <Field label="Code (used in the link)">
          <input
            style={{ ...inputStyle, fontFamily: "monospace", letterSpacing: 1, textTransform: "uppercase", background: codeLocked ? T.paper : "#fff" }}
            value={fields.code}
            onChange={(e) => set("code", cleanCode(e.target.value))}
            disabled={codeLocked}
          />
        </Field>
        <p style={{ ...HINT, marginTop: -6 }}>
          {codeLocked
            ? "🔒 Locked — this form has been published, so its link may already be shared."
            : "Letters and numbers only. You can change it while the form is a Draft; it locks once the form is published."}
        </p>
      </div>

      <div style={SECTION}>
        <h3 style={H3}>Messages</h3>
        <p style={HINT}>The intro shows above the questions; the thank-you message shows after they submit, along with their reference code.</p>
        <RichTextEditor label="Intro" value={fields.intro_html} onChange={(v) => set("intro_html", v)} placeholder="What's this form about?" minHeight={110} />
        <div style={{ height: 14 }} />
        <RichTextEditor label="Thank-you message" value={fields.thank_you_html} onChange={(v) => set("thank_you_html", v)} placeholder="Thanks! We'll be in touch soon." minHeight={90} />
      </div>

      <div style={SECTION}>
        <h3 style={H3}>Questions</h3>
        {hasResponses && <p style={HINT}>This form has responses: removed questions and options are hidden but kept, so older responses still show them.</p>}
        {qs.length === 0 && <p style={{ fontSize: 13, color: T.inkSoft, marginBottom: 12 }}>No questions yet.</p>}
        {qs.map((q, i) => (
          <QuestionCard
            key={q.key}
            q={q}
            index={i}
            count={qs.length}
            lockedType={hasResponses && !q.isNew}
            onChange={(patch) => updateQ(q.key, patch)}
            onMove={(dir) => moveQ(i, dir)}
            onDuplicate={() => duplicateQ(i)}
            onRemove={() => removeQ(i)}
          />
        ))}
        <div className="flex gap-2 items-center flex-wrap">
          <div style={{ minWidth: 220 }}>
            <Select value={newType} onChange={(e) => setNewType(e.target.value)} style={{ padding: "8px 34px 8px 12px", fontSize: 13.5 }}>
              {QUESTION_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </Select>
          </div>
          <Btn size="sm" onClick={addQ}>+ Add question</Btn>
        </div>
      </div>

      <div style={SECTION}>
        <h3 style={H3}>Contact details</h3>
        <p style={HINT}>Choose what to ask for on this form. If any are shown, a Privacy Policy consent box is added automatically. The reference code is based on the name, when asked.</p>
        {[
          ["contact_name_mode", "Name"],
          ["contact_email_mode", "Email"],
          ["contact_phone_mode", "Phone"],
        ].map(([key, label]) => (
          <div key={key} className="flex items-center justify-between gap-3" style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 13.5, color: T.ink, fontWeight: 500 }}>{label}</span>
            <Segmented value={fields[key]} onChange={(v) => set(key, v)} options={CONTACT_MODES} />
          </div>
        ))}
      </div>

      <div style={SECTION}>
        <h3 style={H3}>Settings</h3>
        <Field label="Close automatically after (optional)">
          <div className="flex gap-2 items-center">
            <input style={{ ...inputStyle, maxWidth: 200 }} type="date" value={fields.closes_on} onChange={(e) => set("closes_on", e.target.value)} />
            {fields.closes_on && <button type="button" onClick={() => set("closes_on", "")} style={{ fontSize: 12, color: T.inkSoft, textDecoration: "underline" }}>Clear</button>}
          </div>
        </Field>
        <p style={{ ...HINT, marginTop: -6 }}>A published form stops accepting responses after this day (Sydney time).</p>
        <label className="flex items-center gap-2" style={{ fontSize: 13.5, color: T.ink, marginBottom: 14 }}>
          <input type="checkbox" checked={!!fields.notify_on_response} onChange={(e) => set("notify_on_response", e.target.checked)} />
          Email the studio when someone responds
        </label>

        <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 4 }}>Sharing the form</div>
          <p style={{ ...HINT, marginBottom: 0 }}>
            Once the form is <strong>Published</strong> (not while it's a Draft), use <strong>🔗 Share</strong> at the top to get a link for each place you'll post it — Facebook, WhatsApp, TikTok, a Nritya Mandala notice, a flyer QR code… Each platform gets its own link, so the responses (and the CSV export) show where people came from.
          </p>
        </div>
      </div>

      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 10 }}>{error}</p>}

      {dirty && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, background: "#fff", borderTop: `1px solid ${T.line}`, boxShadow: "0 -4px 12px rgba(0,0,0,0.06)", padding: "10px 16px" }}>
          <div className="flex items-center justify-end gap-2 flex-wrap" style={{ maxWidth: 900, margin: "0 auto" }}>
            {error && <span style={{ color: T.terracotta, fontSize: 12.5, marginRight: "auto" }}>{error}</span>}
            {!error && <span style={{ fontSize: 12.5, color: T.inkSoft, marginRight: "auto" }}>Unsaved changes</span>}
            <Btn variant="ghost" size="sm" onClick={discard} disabled={saving}>Discard</Btn>
            <Btn variant="success" size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Btn>
          </div>
        </div>
      )}

      {previewing && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, overflowY: "auto", background: T.ivory }}>
          <div style={{ position: "sticky", top: 0, zIndex: 1, background: T.maroon, color: "#fff", padding: "10px 16px" }} className="flex items-center justify-between">
            <span style={{ fontSize: 13, fontWeight: 600 }}>Preview{dirty ? " (includes unsaved changes)" : ""}</span>
            <button type="button" onClick={() => setPreviewing(false)} style={{ color: "#fff", fontSize: 13, fontWeight: 700, border: "1px solid #ffffff88", borderRadius: 999, padding: "4px 14px" }}>Close preview</button>
          </div>
          <FormRenderer form={previewForm} preview />
        </div>
      )}
    </div>
  );
}
