import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, ConfirmModal, Select } from "./ui";
import { formatSydneyDateTime } from "../lib/dates";
import { toCsv, downloadCsv } from "../lib/csv";
import {
  DAYS, RESPONSE_STATUSES, responseStatusInfo, answerText, isAnswered, sourceLabel, typeHasOptions,
} from "../lib/forms";

// The "Responses" tab of a form (Admin → Forms): every submission with its
// reference code, contact details and answers; a status and private notes per
// response; search, status filter, CSV export, delete (with a warning); and a
// Summary view counting the answers to each question.

const PAGE_SIZE = 10;

function ResponseCard({ response, questions, onUpdate, onDelete }) {
  const [notes, setNotes] = useState(response.admin_notes || "");
  const [savingNotes, setSavingNotes] = useState(false);
  const status = responseStatusInfo(response.status);
  // Current questions always show (a dash if skipped); removed ones only when answered.
  const shown = questions.filter((q) => !q.archived || isAnswered(response.answers?.[q.id]));

  const saveNotes = async () => {
    if ((response.admin_notes || "") === notes) return;
    setSavingNotes(true);
    await onUpdate({ admin_notes: notes.trim() || null });
    setSavingNotes(false);
  };

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${status.color}`, borderRadius: 10, padding: 14 }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, letterSpacing: 1, color: T.maroonDark, background: "#FBF1E0", border: "1px solid #D9B876", borderRadius: 6, padding: "1px 8px" }}>
              {response.reference_code}
            </span>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{response.name || <span style={{ color: T.inkSoft, fontWeight: 400 }}>No name</span>}</span>
          </div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4, lineHeight: 1.6 }}>
            {formatSydneyDateTime(response.submitted_at)} · via {sourceLabel(response.source)}
            {response.email && <> · <a href={`mailto:${response.email}`} style={{ color: T.gold }}>{response.email}</a></>}
            {response.phone && <> · <a href={`tel:${response.phone}`} style={{ color: T.gold }}>{response.phone}</a></>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div style={{ minWidth: 150 }}>
            <Select value={response.status} onChange={(e) => onUpdate({ status: e.target.value })} style={{ padding: "6px 34px 6px 10px", fontSize: 13, color: status.color, fontWeight: 600 }}>
              {RESPONSE_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          </div>
          <button type="button" onClick={onDelete} title="Delete response" aria-label="Delete response" style={{ fontSize: 13, color: T.terracotta, padding: "4px 6px" }}>🗑</button>
        </div>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
        {shown.map((q) => {
          const text = answerText(q, response.answers?.[q.id]);
          return (
            <div key={q.id} style={{ fontSize: 13, lineHeight: 1.5 }}>
              <div style={{ color: T.inkSoft, fontSize: 12 }}>{q.label}{q.archived ? " (removed question)" : ""}</div>
              <div style={{ color: text ? T.ink : T.inkSoft, whiteSpace: "pre-wrap" }}>{text || "—"}</div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10 }}>
        <textarea
          style={{ ...inputStyle, minHeight: 44, fontSize: 12.5 }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="Private notes (only staff see these) — saved when you click away"
        />
        {savingNotes && <span style={{ fontSize: 11, color: T.inkSoft }}>Saving…</span>}
      </div>
    </div>
  );
}

// Counts per option (choice, dropdown, yes/no, rating), a Mon–Sun grid for
// preferred days & times, and the answers themselves for text questions.
function Summary({ responses, questions }) {
  const current = questions.filter((q) => !q.archived);
  if (responses.length === 0) return <p style={{ fontSize: 13, color: T.inkSoft }}>No responses to summarise yet.</p>;

  const bar = (label, count, total) => (
    <div key={label} style={{ marginBottom: 6 }}>
      <div className="flex justify-between" style={{ fontSize: 12.5, color: T.ink, marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ color: T.inkSoft }}>{count} ({total ? Math.round((count / total) * 100) : 0}%)</span>
      </div>
      <div style={{ height: 8, background: T.paper, borderRadius: 999 }}>
        <div style={{ height: 8, width: `${total ? (count / total) * 100 : 0}%`, background: T.gold, borderRadius: 999 }} />
      </div>
    </div>
  );

  return (
    <div className="grid gap-3">
      <p style={{ fontSize: 12.5, color: T.inkSoft }}>Based on {responses.length} response{responses.length === 1 ? "" : "s"} (the current filter applies).</p>
      {current.map((q) => {
        const values = responses.map((r) => r.answers?.[q.id]).filter(isAnswered);
        const answered = values.length;
        let body;
        if (q.type === "day_time") {
          const slots = (q.options || []).filter((o) => !o.archived);
          const countFor = (key) => values.filter((v) => v.includes(key)).length;
          const max = Math.max(1, ...DAYS.flatMap((d) => slots.map((s) => countFor(`${d.key}:${s.id}`))));
          body = (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr><th />{slots.map((s) => <th key={s.id} style={{ padding: "4px 10px", color: T.inkSoft, fontWeight: 600 }}>{s.label}</th>)}</tr>
                </thead>
                <tbody>
                  {DAYS.map((d) => (
                    <tr key={d.key}>
                      <td style={{ padding: "4px 10px 4px 0", fontWeight: 600 }}>{d.label}</td>
                      {slots.map((s) => {
                        const c = countFor(`${d.key}:${s.id}`);
                        return (
                          <td key={s.id} style={{ textAlign: "center", padding: 3 }}>
                            <div style={{ minWidth: 44, padding: "5px 0", borderRadius: 6, fontWeight: 600, background: c ? `rgba(197,141,46,${0.15 + 0.7 * (c / max)})` : T.paper, color: c ? T.maroonDark : T.inkSoft }}>{c}</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        } else if (typeHasOptions(q.type)) {
          const opts = (q.options || []).filter((o) => !o.archived);
          const countFor = (id) => values.filter((v) => (Array.isArray(v) ? v.includes(id) : v === id)).length;
          body = opts.map((o) => bar(o.label, countFor(o.id), answered));
        } else if (q.type === "yes_no") {
          body = [bar("Yes", values.filter((v) => v === "yes").length, answered), bar("No", values.filter((v) => v === "no").length, answered)];
        } else if (q.type === "rating") {
          const avg = answered ? (values.reduce((a, b) => a + Number(b), 0) / answered).toFixed(1) : "–";
          body = (
            <>
              <p style={{ fontSize: 13, color: T.ink, marginBottom: 6 }}>Average: <strong>{avg}</strong> / 5</p>
              {[5, 4, 3, 2, 1].map((n) => bar(`${n}`, values.filter((v) => Number(v) === n).length, answered))}
            </>
          );
        } else {
          body = (
            <div style={{ maxHeight: 180, overflowY: "auto", display: "grid", gap: 4 }}>
              {values.length === 0 && <span style={{ fontSize: 12.5, color: T.inkSoft }}>No answers yet.</span>}
              {values.map((v, i) => <div key={i} style={{ fontSize: 12.5, color: T.ink, background: T.paper, borderRadius: 6, padding: "5px 8px", whiteSpace: "pre-wrap" }}>{String(v)}</div>)}
            </div>
          );
        }
        return (
          <div key={q.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{q.label}</div>
            <div style={{ fontSize: 11.5, color: T.inkSoft, marginBottom: 10 }}>{answered} of {responses.length} answered</div>
            {body}
          </div>
        );
      })}
    </div>
  );
}

export default function FormResponses({ form, questions, onCountsChange }) {
  const [responses, setResponses] = useState(null);
  const [view, setView] = useState("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("form_responses").select("*").eq("form_id", form.id).order("submitted_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        setResponses(data || []);
      });
  }, [form.id]);

  const filtered = useMemo(() => {
    if (!responses) return [];
    const term = search.trim().toLowerCase();
    return responses.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (!term) return true;
      return [r.reference_code, r.name, r.email, r.phone].some((v) => (v || "").toLowerCase().includes(term));
    });
  }, [responses, search, statusFilter]);

  const update = async (id, patch) => {
    const { error: err } = await supabase.from("form_responses").update(patch).eq("id", id);
    if (err) { setError(err.message); return; }
    setResponses((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    if (patch.status) onCountsChange?.();
  };

  const remove = async () => {
    const r = confirmDelete;
    setConfirmDelete(null);
    const { error: err } = await supabase.from("form_responses").delete().eq("id", r.id);
    if (err) { setError(err.message); return; }
    setResponses((cur) => cur.filter((x) => x.id !== r.id));
    onCountsChange?.();
  };

  const exportCsv = () => {
    const qCols = questions.filter((q) => !q.archived || filtered.some((r) => isAnswered(r.answers?.[q.id])));
    const columns = [
      { key: "reference_code", label: "Reference" },
      { key: "submitted", label: "Submitted" },
      { key: "status", label: "Status" },
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "source", label: "Came from" },
      ...qCols.map((q) => ({ key: `q_${q.id}`, label: q.archived ? `${q.label} (removed question)` : q.label })),
      { key: "admin_notes", label: "Notes" },
    ];
    const rows = filtered.map((r) => ({
      reference_code: r.reference_code,
      submitted: formatSydneyDateTime(r.submitted_at),
      status: responseStatusInfo(r.status).label,
      name: r.name || "",
      email: r.email || "",
      phone: r.phone || "",
      source: sourceLabel(r.source),
      admin_notes: r.admin_notes || "",
      ...Object.fromEntries(qCols.map((q) => [`q_${q.id}`, answerText(q, r.answers?.[q.id])])),
    }));
    downloadCsv(`${form.code}-responses.csv`, toCsv(rows, columns));
  };

  if (responses === null) return <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>;

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 12 }}>
        <div className="inline-flex" style={{ background: T.paper, borderRadius: 8, padding: 3 }}>
          {[["list", "Responses"], ["summary", "Summary"]].map(([k, label]) => (
            <button key={k} type="button" onClick={() => setView(k)} style={{ fontSize: 12.5, fontWeight: 600, padding: "5px 12px", borderRadius: 6, background: view === k ? "#fff" : "transparent", color: view === k ? T.maroonDark : T.inkSoft }}>{label}</button>
          ))}
        </div>
        <input style={{ ...inputStyle, maxWidth: 230, fontSize: 13 }} value={search} onChange={(e) => { setSearch(e.target.value); setShown(PAGE_SIZE); }} placeholder="Search name, email, reference…" />
        <div style={{ minWidth: 160 }}>
          <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setShown(PAGE_SIZE); }} style={{ padding: "7px 34px 7px 10px", fontSize: 13 }}>
            <option value="">All statuses</option>
            {RESPONSE_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </Select>
        </div>
        <div className="ml-auto">
          <Btn size="sm" variant="ghost" onClick={exportCsv} disabled={filtered.length === 0}>⬇ Export CSV</Btn>
        </div>
      </div>

      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 10 }}>{error}</p>}

      {view === "summary" ? (
        <Summary responses={filtered} questions={questions} />
      ) : filtered.length === 0 ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>{responses.length === 0 ? "No responses yet — share the form to start collecting them." : "No responses match."}</p>
      ) : (
        <div className="grid gap-3">
          {filtered.slice(0, shown).map((r) => (
            <ResponseCard key={r.id} response={r} questions={questions} onUpdate={(patch) => update(r.id, patch)} onDelete={() => setConfirmDelete(r)} />
          ))}
          {filtered.length > shown && (
            <div className="text-center"><Btn size="sm" variant="ghost" onClick={() => setShown((n) => n + PAGE_SIZE)}>Show more ({filtered.length - shown} more)</Btn></div>
          )}
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete this response?"
          message={<>Delete <strong>{confirmDelete.reference_code}</strong>{confirmDelete.name ? ` (${confirmDelete.name})` : ""}'s response? This can't be undone.</>}
          confirmLabel="Delete response"
          onConfirm={remove}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
