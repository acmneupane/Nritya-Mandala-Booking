import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Field, Modal, TypeToConfirmModal } from "./ui";
import QrModal from "./QrCode";
import { RELATION_OPTIONS } from "../lib/relations";
import { computeAge } from "../lib/age";
import { generateStudentCode } from "../lib/studentCode";
import { formatTimeRange } from "../lib/scheduling";

const actionBtnStyle = { fontSize: 13, fontWeight: 500, padding: "5px 12px", borderRadius: 999, border: "1px solid", background: "#fff", whiteSpace: "nowrap" };

function LevelBadge({ level }) {
  if (!level) return <span style={{ fontSize: 12, color: T.inkSoft }}>Unassigned</span>;
  return (
    <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 999, background: `${T.sage}22`, color: T.sage, fontWeight: 600 }}>{level.name}</span>
  );
}

function PackageBadge({ remaining, hasAny }) {
  if (!hasAny) return <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 999, background: `${T.terracotta}18`, color: T.terracotta, fontWeight: 600 }}>No package on file</span>;
  const ok = remaining > 0;
  return (
    <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 999, background: ok ? `${T.sage}18` : `${T.terracotta}18`, color: ok ? T.sage : T.terracotta, fontWeight: 600 }}>
      {remaining} class{remaining === 1 ? "" : "es"} left
    </span>
  );
}

// Packages purchased (classes bought + amount paid + a note) and a running remaining count.
// This is what tracks "how many classes has this student booked for, based on payment."
function PackagesSection({ studentId }) {
  const [packages, setPackages] = useState([]);
  const [used, setUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [classesTotal, setClassesTotal] = useState(10);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [pRes, sRes] = await Promise.all([
      supabase.from("packages").select("*").eq("student_id", studentId).order("purchase_date", { ascending: false }),
      supabase.from("student_package_summary").select("classes_used").eq("student_id", studentId).maybeSingle(),
    ]);
    setPackages(pRes.data || []);
    setUsed(sRes.data?.classes_used || 0);
    setLoading(false);
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const total = packages.reduce((sum, p) => sum + p.classes_total, 0);
  const remaining = total - used;

  const addPackage = async () => {
    if (!classesTotal || Number(classesTotal) <= 0) return;
    setSaving(true);
    await supabase.from("packages").insert({
      student_id: studentId,
      classes_total: Number(classesTotal),
      amount: amount ? Number(amount) : null,
      notes: note.trim(),
    });
    setSaving(false);
    setAdding(false);
    setClassesTotal(10);
    setAmount("");
    setNote("");
    load();
  };

  const removePackage = async (id) => {
    await supabase.from("packages").delete().eq("id", id);
    load();
  };

  if (loading) return <p style={{ fontSize: 12, color: T.inkSoft }}>Loading packages…</p>;

  return (
    <div className="mt-2 mb-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: T.inkSoft }}>Packages &amp; payments</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: remaining > 0 ? T.sage : T.terracotta }}>{remaining} of {total} classes remaining</span>
      </div>
      {packages.length === 0 && !adding && <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 8 }}>No packages on file yet.</p>}
      {packages.map((p) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${T.line}`, borderRadius: 6, padding: "6px 10px", marginBottom: 6, fontSize: 12 }}>
          <div>
            <span style={{ fontWeight: 600 }}>{p.classes_total} classes</span>
            {p.amount != null && <span style={{ color: T.inkSoft, marginLeft: 6 }}>· ${Number(p.amount).toFixed(2)}</span>}
            <span style={{ color: T.inkSoft, marginLeft: 6 }}>· {p.purchase_date}</span>
            {p.notes && <div style={{ color: T.inkSoft, marginTop: 2 }}>{p.notes}</div>}
          </div>
          <button onClick={() => removePackage(p.id)} style={{ color: T.terracotta }}>✕</button>
        </div>
      ))}
      {adding ? (
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 10, marginTop: 6 }}>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Field label="Classes bought"><input style={inputStyle} type="number" min={1} value={classesTotal} onChange={(e) => setClassesTotal(e.target.value)} /></Field>
            <Field label="Amount paid ($)"><input style={inputStyle} type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 120.00" /></Field>
          </div>
          <Field label="Note"><input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. paid cash, 10-class pack" /></Field>
          <div className="flex justify-end gap-2 mt-1">
            <Btn variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Btn>
            <Btn size="sm" onClick={addPackage} disabled={saving}>{saving ? "Saving…" : "Add package"}</Btn>
          </div>
        </div>
      ) : (
        <Btn size="sm" variant="ghost" onClick={() => setAdding(true)}>+ Add package</Btn>
      )}
    </div>
  );
}

// Same idea as PackagesSection but for a student that doesn't exist yet — packages are
// held here locally and only written to the database once the student is created.
function PendingPackagesEditor({ pendingPackages, setPendingPackages }) {
  const [adding, setAdding] = useState(pendingPackages.length === 0);
  const [classesTotal, setClassesTotal] = useState(10);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const addPackage = () => {
    if (!classesTotal || Number(classesTotal) <= 0) return;
    setPendingPackages((ps) => [...ps, { classesTotal: Number(classesTotal), amount: amount ? Number(amount) : null, note: note.trim() }]);
    setAdding(false);
    setClassesTotal(10);
    setAmount("");
    setNote("");
  };
  const removePackage = (i) => setPendingPackages((ps) => ps.filter((_, idx) => idx !== i));

  return (
    <div className="mt-2 mb-1">
      <span className="text-xs font-medium block mb-2" style={{ color: T.inkSoft }}>Starting package (optional)</span>
      {pendingPackages.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${T.line}`, borderRadius: 6, padding: "6px 10px", marginBottom: 6, fontSize: 12 }}>
          <div>
            <span style={{ fontWeight: 600 }}>{p.classesTotal} classes</span>
            {p.amount != null && <span style={{ color: T.inkSoft, marginLeft: 6 }}>· ${Number(p.amount).toFixed(2)}</span>}
            {p.note && <div style={{ color: T.inkSoft, marginTop: 2 }}>{p.note}</div>}
          </div>
          <button onClick={() => removePackage(i)} style={{ color: T.terracotta }}>✕</button>
        </div>
      ))}
      {adding ? (
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 10 }}>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Field label="Classes bought"><input style={inputStyle} type="number" min={1} value={classesTotal} onChange={(e) => setClassesTotal(e.target.value)} /></Field>
            <Field label="Amount paid ($)"><input style={inputStyle} type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 90.00" /></Field>
          </div>
          <Field label="Note"><input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 5-week package" /></Field>
          <div className="flex justify-end gap-2 mt-1">
            {pendingPackages.length > 0 && <Btn variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Btn>}
            <Btn size="sm" onClick={addPackage}>Add package</Btn>
          </div>
        </div>
      ) : (
        <Btn size="sm" variant="ghost" onClick={() => setAdding(true)}>+ Add another package</Btn>
      )}
      <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>You can always add more packages later as they buy them — this is just to record what they've already paid, if anything.</p>
    </div>
  );
}

function StudentModal({ initial, levels, allGuardians, onClose, onSaved }) {
  const [name, setName] = useState(initial?.name || "");
  const [dob, setDob] = useState(initial?.dob || "");
  const [levelId, setLevelId] = useState(initial?.level_id || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [code, setCode] = useState(initial?.code || "");
  // Only used when creating a brand-new student — a package entered here gets saved
  // right after the student is created, since there's no student id to attach it to yet.
  const [pendingPackages, setPendingPackages] = useState([]);
  const [links, setLinks] = useState([]); // {guardian_id, name, phone, email, relation, emergency}
  const [originalLinkIds, setOriginalLinkIds] = useState([]);
  const [guardianQuery, setGuardianQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [regenerating, setRegenerating] = useState(false);
  const regenerateCode = async () => {
    setRegenerating(true);
    try {
      setCode(await generateStudentCode(supabase, name, initial?.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setRegenerating(false);
    }
  };

  useEffect(() => {
    if (!initial?.id) return;
    supabase
      .from("student_guardians")
      .select("id, guardian_id, relation, emergency, guardians(id, name, phone, email)")
      .eq("student_id", initial.id)
      .then(({ data }) => {
        setOriginalLinkIds((data || []).map((l) => l.id));
        setLinks((data || []).map((l) => ({
          linkId: l.id,
          guardianId: l.guardian_id,
          name: l.guardians?.name || "",
          phone: l.guardians?.phone || "",
          email: l.guardians?.email || "",
          relation: RELATION_OPTIONS.includes(l.relation) ? l.relation : "Other",
          relationOther: RELATION_OPTIONS.includes(l.relation) ? "" : l.relation,
          emergency: l.emergency,
        })));
      });
  }, [initial?.id]);

  const addNewGuardian = () => {
    setLinks((ls) => [...ls, { linkId: null, guardianId: null, name: "", phone: "", email: "", relation: "", relationOther: "", emergency: ls.length === 0, isNew: true }]);
  };
  const linkExistingGuardian = (g) => {
    if (links.some((l) => l.guardianId === g.id)) return;
    setLinks((ls) => [...ls, { linkId: null, guardianId: g.id, name: g.name, phone: g.phone, email: g.email || "", relation: "", relationOther: "", emergency: ls.length === 0, isExisting: true }]);
    setGuardianQuery("");
  };
  const updateLink = (i, field, val) => setLinks((ls) => ls.map((l, idx) => (idx === i ? { ...l, [field]: val } : l)));
  const removeLink = (i) => setLinks((ls) => ls.filter((_, idx) => idx !== i));

  const matches = guardianQuery.trim()
    ? allGuardians.filter((g) => g.name.toLowerCase().includes(guardianQuery.toLowerCase()) && !links.some((l) => l.guardianId === g.id))
    : [];

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      // Resolve the access code: use what's typed, or generate a name-based one if left blank.
      let finalCode = code.trim().toUpperCase();
      if (!finalCode) {
        finalCode = await generateStudentCode(supabase, name, initial?.id);
      } else {
        let clashQuery = supabase.from("students").select("id").eq("code", finalCode);
        if (initial?.id) clashQuery = clashQuery.neq("id", initial.id);
        const { data: clash } = await clashQuery.maybeSingle();
        if (clash) { setError(`Code "${finalCode}" is already in use by another student.`); setSaving(false); return; }
      }

      let studentId = initial?.id;
      if (studentId) {
        const { error } = await supabase.from("students").update({
          name: name.trim(), dob: dob || null, level_id: levelId || null, notes: notes.trim(), code: finalCode,
        }).eq("id", studentId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("students").insert({
          name: name.trim(), dob: dob || null, level_id: levelId || null, notes: notes.trim(), code: finalCode,
        }).select().single();
        if (error) throw error;
        studentId = data.id;

        for (const p of pendingPackages) {
          await supabase.from("packages").insert({
            student_id: studentId, classes_total: p.classesTotal, amount: p.amount, notes: p.note,
          });
        }
      }

      // Sync guardian links: create new guardian people as needed, keep existing ones'
      // contact details (including email) current, and upsert the relationship rows.
      // "Other" isn't saved literally — whatever they typed becomes the relation itself.
      const keptLinkIds = links.map((l) => l.linkId).filter(Boolean);
      const removedLinkIds = originalLinkIds.filter((id) => !keptLinkIds.includes(id));
      for (const id of removedLinkIds) {
        await supabase.from("student_guardians").delete().eq("id", id);
      }

      for (const l of links) {
        const finalRelation = l.relation === "Other" ? (l.relationOther || "").trim() || "Other" : l.relation;
        let guardianId = l.guardianId;
        if (!guardianId && l.name.trim()) {
          const { data, error } = await supabase.from("guardians").insert({ name: l.name.trim(), phone: l.phone.trim(), email: l.email.trim() }).select().single();
          if (error) throw error;
          guardianId = data.id;
        } else if (guardianId && l.isExisting) {
          await supabase.from("guardians").update({ email: l.email.trim() }).eq("id", guardianId);
        }
        if (!guardianId) continue;
        if (l.linkId) {
          await supabase.from("student_guardians").update({ relation: finalRelation, emergency: l.emergency }).eq("id", l.linkId);
        } else {
          await supabase.from("student_guardians").insert({ student_id: studentId, guardian_id: guardianId, relation: finalRelation, emergency: l.emergency });
        }
      }

      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? "Edit student" : "Add a student"} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Student's name" /></Field>
        <Field label="Date of birth"><input style={inputStyle} type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></Field>
      </div>
      <Field label="Level">
        <select style={inputStyle} value={levelId} onChange={(e) => setLevelId(e.target.value)}>
          <option value="">Unassigned</option>
          {[...levels].sort((a, b) => a.order_num - b.order_num).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </Field>
      <Field label="Notes (allergies, needs, etc.)"><textarea style={{ ...inputStyle, minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>

      <Field label="Access code (parent lookup & QR)">
        <div className="flex gap-2">
          <input style={{ ...inputStyle, letterSpacing: 2, fontWeight: 600 }} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Auto-generated if left blank" />
          <Btn size="sm" variant="ghost" onClick={regenerateCode} disabled={regenerating}>{regenerating ? "Generating…" : "Generate new"}</Btn>
        </div>
      </Field>

      {initial?.id ? <PackagesSection studentId={initial.id} /> : <PendingPackagesEditor pendingPackages={pendingPackages} setPendingPackages={setPendingPackages} />}

      <div className="mt-2 mb-1">
        <span className="text-xs font-medium block mb-2" style={{ color: T.inkSoft }}>Parent / emergency contacts</span>
        <div className="flex gap-2 mb-2 relative">
          <input style={inputStyle} placeholder="Search existing guardians by name…" value={guardianQuery} onChange={(e) => setGuardianQuery(e.target.value)} />
          <Btn size="sm" onClick={addNewGuardian}>+ New</Btn>
          {matches.length > 0 && (
            <div style={{ position: "absolute", top: 38, left: 0, right: 90, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, zIndex: 5, maxHeight: 140, overflowY: "auto" }}>
              {matches.map((g) => (
                <button key={g.id} onClick={() => linkExistingGuardian(g)} style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", fontSize: 13 }}>
                  {g.name} <span style={{ color: T.inkSoft, fontSize: 11 }}>· {g.phone}{g.email ? ` · ${g.email}` : ""}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {links.map((l, i) => (
        <div key={i} style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input style={inputStyle} placeholder="Name" value={l.name} disabled={!!l.isExisting} onChange={(e) => updateLink(i, "name", e.target.value)} />
            <input style={inputStyle} placeholder="Phone" value={l.phone} disabled={!!l.isExisting} onChange={(e) => updateLink(i, "phone", e.target.value)} />
          </div>
          <input style={{ ...inputStyle, marginBottom: 8 }} type="email" placeholder="Email" value={l.email} onChange={(e) => updateLink(i, "email", e.target.value)} />
          <div className="flex items-center gap-3 flex-wrap">
            <select style={{ ...inputStyle, width: 140 }} value={l.relation} onChange={(e) => updateLink(i, "relation", e.target.value)}>
              <option value="">Select…</option>
              {RELATION_OPTIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
            {l.relation === "Other" && (
              <input style={{ ...inputStyle, width: 140 }} placeholder="Please specify" value={l.relationOther} onChange={(e) => updateLink(i, "relationOther", e.target.value)} />
            )}
            <label className="flex items-center gap-1.5 text-xs" style={{ color: T.inkSoft }}>
              <input type="checkbox" checked={l.emergency} onChange={(e) => updateLink(i, "emergency", e.target.checked)} /> Emergency contact
            </label>
            <button onClick={() => removeLink(i)} style={{ color: T.terracotta, marginLeft: "auto" }}>✕</button>
          </div>
          {l.isExisting && <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>Existing guardian — name/phone shared across their students; edit those from any of them. Email can be updated here.</p>}
        </div>
      ))}

      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : initial ? "Save changes" : "Save student"}</Btn>
      </div>
    </Modal>
  );
}

function BookClassModal({ student, onClose, onBooked }) {
  const [classes, setClasses] = useState([]);
  const [enrolledIds, setEnrolledIds] = useState([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("classes").select("*"),
      supabase.from("enrollments").select("class_id").eq("student_id", student.id),
    ]).then(([cRes, eRes]) => {
      setClasses((cRes.data || []).slice().sort((a, b) => a.day.localeCompare(b.day) || a.time.localeCompare(b.time)));
      setEnrolledIds((eRes.data || []).map((e) => e.class_id));
      setLoading(false);
    });
  }, [student.id]);

  const available = classes.filter((c) => !enrolledIds.includes(c.id));

  const book = async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    const { error } = await supabase.from("enrollments").insert({ student_id: student.id, class_id: selected });
    setSaving(false);
    if (error) { setError(error.message); return; }
    onBooked();
  };

  return (
    <Modal title={`Book ${student.name} into a class`} onClose={onClose}>
      {loading ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>
      ) : available.length === 0 ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>{classes.length === 0 ? "No classes set up yet — add one under the Classes tab first." : "Already booked into every class."}</p>
      ) : (
        <>
          <Field label="Class">
            <select style={inputStyle} value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Select a class…</option>
              {available.map((c) => <option key={c.id} value={c.id}>{c.label} — {c.day} {formatTimeRange(c.time, c.end_time)}</option>)}
            </select>
          </Field>
          {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 8 }}>{error}</p>}
          <div className="flex justify-end gap-2 mt-2">
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn onClick={book} disabled={saving || !selected}>{saving ? "Booking…" : "Book"}</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

export default function StudentsView() {
  const [students, setStudents] = useState([]);
  const [levels, setLevels] = useState([]);
  const [guardians, setGuardians] = useState([]);
  const [pkgSummaryByStudent, setPkgSummaryByStudent] = useState({});
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [showingQr, setShowingQr] = useState(null);
  const [booking, setBooking] = useState(null);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, lRes, gRes, pRes] = await Promise.all([
      supabase.from("students").select("*").order("name"),
      supabase.from("levels").select("*"),
      supabase.from("guardians").select("*").order("name"),
      supabase.from("student_package_summary").select("*"),
    ]);
    setStudents(sRes.data || []);
    setLevels(lRes.data || []);
    setGuardians(gRes.data || []);
    const map = {};
    (pRes.data || []).forEach((p) => { map[p.student_id] = p; });
    setPkgSummaryByStudent(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const levelById = Object.fromEntries(levels.map((l) => [l.id, l]));
  const filtered = students
    .filter((s) => !!s.archived === showArchived)
    .filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  const doArchive = async (id, archived) => {
    await supabase.from("students").update({ archived }).eq("id", id);
    setConfirmArchive(null);
    load();
  };
  const doRemove = async (id) => {
    // Before deleting, find which guardians are linked to this student — if any of
    // them turn out to have no other students once this one's gone, their record is
    // just clutter and gets removed too.
    const { data: links } = await supabase.from("student_guardians").select("guardian_id").eq("student_id", id);
    const guardianIds = [...new Set((links || []).map((l) => l.guardian_id))];

    await supabase.from("student_guardians").delete().eq("student_id", id);
    await supabase.from("students").delete().eq("id", id);

    for (const guardianId of guardianIds) {
      const { count } = await supabase.from("student_guardians").select("id", { count: "exact", head: true }).eq("guardian_id", guardianId);
      if (!count) {
        await supabase.from("guardians").delete().eq("id", guardianId);
      }
    }

    setConfirmRemove(null);
    load();
  };

  if (loading) return <p style={{ color: T.inkSoft }}>Loading…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <input style={{ ...inputStyle, width: 220, maxWidth: "60vw" }} placeholder="Search students…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button onClick={() => setShowArchived((v) => !v)} style={{ fontSize: 12, color: showArchived ? T.maroon : T.inkSoft, fontWeight: showArchived ? 600 : 400 }}>
            {showArchived ? "← Back to active students" : "View archived students"}
          </button>
        </div>
        {!showArchived && <Btn onClick={() => setAdding(true)}>+ Add student</Btn>}
      </div>
      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", color: T.inkSoft }}>
          <p>{showArchived ? "No archived students." : "No students yet. Add the first one to get started."}</p>
        </div>
      )}
      <div className="grid gap-4">
        {filtered.map((s) => {
          const pkg = pkgSummaryByStudent[s.id];
          const remaining = pkg ? pkg.classes_total - pkg.classes_used : 0;
          return (
            <div key={s.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderLeft: `5px solid ${s.archived ? T.inkSoft : T.gold}`, borderRadius: 10, padding: 18, opacity: s.archived ? 0.7 : 1 }} className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span style={{ fontFamily: "Fraunces, serif", fontSize: 19, color: T.maroonDark }}>{s.name}</span>
                  {s.dob && computeAge(s.dob) != null && <span style={{ fontSize: 13, color: T.inkSoft }}>· {computeAge(s.dob)}y</span>}
                  <span style={{ fontSize: 12, color: T.gold, fontWeight: 700, letterSpacing: 1 }}>· {s.code}</span>
                  {!s.archived && (
                    <button onClick={() => setShowingQr(s)} style={{ ...actionBtnStyle, color: T.gold, borderColor: `${T.gold}55`, fontSize: 12, padding: "3px 9px" }}>QR code</button>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <LevelBadge level={levelById[s.level_id]} />
                  <PackageBadge remaining={remaining} hasAny={!!pkg && pkg.classes_total > 0} />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {!s.archived && <button onClick={() => setBooking(s)} style={{ ...actionBtnStyle, color: T.sage, borderColor: `${T.sage}55` }}>Book class</button>}
                {!s.archived && <button onClick={() => setEditing(s)} style={{ ...actionBtnStyle, color: T.maroon, borderColor: `${T.maroon}55` }}>Edit</button>}
                {s.archived ? (
                  <button onClick={() => doArchive(s.id, false)} style={{ ...actionBtnStyle, color: T.sage, borderColor: `${T.sage}55` }}>Restore</button>
                ) : (
                  <button onClick={() => setConfirmArchive(s)} style={{ ...actionBtnStyle, color: T.inkSoft, borderColor: T.line }}>Archive</button>
                )}
                <button onClick={() => setConfirmRemove(s)} style={{ ...actionBtnStyle, color: T.terracotta, borderColor: `${T.terracotta}55` }}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>
      {(adding || editing) && (
        <StudentModal
          initial={editing}
          levels={levels}
          allGuardians={guardians}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); load(); }}
        />
      )}
      {showingQr && <QrModal student={showingQr} onClose={() => setShowingQr(null)} />}
      {booking && <BookClassModal student={booking} onClose={() => setBooking(null)} onBooked={() => { setBooking(null); load(); }} />}
      {confirmArchive && (
        <TypeToConfirmModal
          title="Archive this student?"
          message={`${confirmArchive.name} will be hidden from the active roster, but their attendance, packages and level history are all kept. You can restore them anytime.`}
          confirmString={confirmArchive.code}
          confirmLabel="Archive"
          onConfirm={() => doArchive(confirmArchive.id, true)}
          onCancel={() => setConfirmArchive(null)}
        />
      )}
      {confirmRemove && (
        <TypeToConfirmModal
          title="Delete permanently?"
          message={`This permanently deletes ${confirmRemove.name} and all their records — bookings, attendance, packages, level history. This can't be undone. If you just want them off the active list, use Archive instead.`}
          confirmString={confirmRemove.code}
          confirmLabel="Delete permanently"
          onConfirm={() => doRemove(confirmRemove.id)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}
