import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Field, Modal, TypeToConfirmModal } from "./ui";

const CATEGORIES = ["Rent", "Wages", "Utilities", "Equipment", "Marketing", "Refund", "Other"];
const MAX_RECEIPT_SIZE = 5 * 1024 * 1024; // 5MB

function ExpenseModal({ initial, classes, adminUsers, onClose, onSaved }) {
  const [description, setDescription] = useState(initial?.description || "");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [category, setCategory] = useState(initial?.category || "Other");
  const [expenseType, setExpenseType] = useState(initial?.expense_type || "one_off");
  const [recurrence, setRecurrence] = useState(initial?.recurrence || "monthly");
  const [classId, setClassId] = useState(initial?.class_id || "");
  const [startDate, setStartDate] = useState(initial?.start_date || new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(initial?.end_date || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [receiptFile, setReceiptFile] = useState(null);
  // "" = not recorded, "other" = paidByOther note, else an admin user's id.
  const [paidBy, setPaidBy] = useState(initial?.paid_by_user_id || (initial?.paid_by_other ? "other" : ""));
  const [paidByOther, setPaidByOther] = useState(initial?.paid_by_other || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!description.trim() || !amount) { setError("Description and amount are required."); return; }
    if (expenseType === "per_class" && !classId) { setError("Please select which class this expense applies to."); return; }
    if (receiptFile && receiptFile.size > MAX_RECEIPT_SIZE) { setError("Receipt file is too large — please keep it under 5MB."); return; }
    setSaving(true);
    setError("");
    try {
      let receiptPath = initial?.receipt_path || null;
      if (receiptFile) {
        const ext = receiptFile.name.split(".").pop() || "file";
        receiptPath = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("expense-receipts").upload(receiptPath, receiptFile);
        if (uploadErr) throw new Error("Couldn't upload the receipt — please try again.");
      }
      const payload = {
        description: description.trim(), amount: Number(amount), category, expense_type: expenseType,
        recurrence: expenseType === "recurring" ? recurrence : null,
        class_id: expenseType === "per_class" ? classId : null,
        start_date: startDate, end_date: endDate || null,
        notes: notes.trim() || null, receipt_path: receiptPath,
        paid_by_user_id: paidBy && paidBy !== "other" ? paidBy : null,
        paid_by_other: paidBy === "other" ? (paidByOther.trim() || null) : null,
      };
      const { error: saveErr } = initial?.id
        ? await supabase.from("expenses").update(payload).eq("id", initial.id)
        : await supabase.from("expenses").insert(payload);
      if (saveErr) throw saveErr;
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? "Edit expense" : "Add an expense"} onClose={onClose} wide>
      <Field label="Description"><input style={inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Studio rent, New sound system" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount ($)"><input style={inputStyle} type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Category">
          <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Type">
        <div className="flex gap-3 flex-wrap" style={{ fontSize: 13, color: T.ink }}>
          <label className="flex items-center gap-1.5"><input type="radio" checked={expenseType === "one_off"} onChange={() => setExpenseType("one_off")} /> One-off</label>
          <label className="flex items-center gap-1.5"><input type="radio" checked={expenseType === "recurring"} onChange={() => setExpenseType("recurring")} /> Recurring</label>
          <label className="flex items-center gap-1.5"><input type="radio" checked={expenseType === "per_class"} onChange={() => setExpenseType("per_class")} /> Per class session</label>
        </div>
      </Field>

      {expenseType === "recurring" && (
        <Field label="Frequency">
          <select style={inputStyle} value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </Field>
      )}

      {expenseType === "per_class" && (
        <Field label="Which class?">
          <select style={inputStyle} value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Select a class…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.label} — {c.day} {c.time}</option>)}
          </select>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={expenseType === "one_off" ? "Date" : "Start date"}>
          <input style={inputStyle} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        {expenseType !== "one_off" && (
          <Field label="End date (optional)"><input style={inputStyle} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
        )}
      </div>

      <Field label="Who paid? (optional)">
        <select style={inputStyle} value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
          <option value="">— Not recorded —</option>
          {adminUsers.map((u) => <option key={u.id} value={u.id}>{adminUserLabel(u)}</option>)}
          <option value="other">Other…</option>
        </select>
      </Field>
      {paidBy === "other" && (
        <Field label="Who?"><input style={inputStyle} value={paidByOther} onChange={(e) => setPaidByOther(e.target.value)} placeholder="e.g. a name, or how it was paid" /></Field>
      )}

      <Field label="Notes (optional)"><textarea style={{ ...inputStyle, minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <Field label="Receipt (optional, max 5MB)">
        <input type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} style={{ fontSize: 13 }} />
        {initial?.receipt_path && !receiptFile && <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>A receipt is already attached — choosing a new file will replace it.</p>}
      </Field>

      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <div className="flex justify-end gap-2 mt-2">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="success" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save expense"}</Btn>
      </div>
    </Modal>
  );
}

function typeLabel(e) {
  if (e.expense_type === "one_off") return "One-off";
  if (e.expense_type === "recurring") return e.recurrence === "weekly" ? "Weekly" : "Monthly";
  return "Per class";
}

// Each admin's own display name (set from their Account page) if they've given
// one, else their email — same fallback everywhere an admin user shows up.
function adminUserLabel(u) {
  return u.display_name || u.email;
}

export default function ExpensesView() {
  const [expenses, setExpenses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [eRes, cRes, uRes] = await Promise.all([
      supabase.from("expenses").select("*").order("start_date", { ascending: false }),
      supabase.from("classes").select("id, label, day, time"),
      supabase.rpc("list_admin_users"),
    ]);
    setExpenses(eRes.data || []);
    setClasses(cRes.data || []);
    setAdminUsers(uRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const viewReceipt = async (path) => {
    const { data, error } = await supabase.storage.from("expense-receipts").createSignedUrl(path, 300);
    if (error || !data) { alert("Couldn't load the receipt."); return; }
    window.open(data.signedUrl, "_blank");
  };

  const doRemove = async (id) => {
    await supabase.from("expenses").delete().eq("id", id);
    setConfirmRemove(null);
    load();
  };

  const classById = Object.fromEntries(classes.map((c) => [c.id, c]));
  const adminUserById = Object.fromEntries(adminUsers.map((u) => [u.id, u]));
  const paidByLabel = (e) => (e.paid_by_user_id ? (adminUserById[e.paid_by_user_id] && adminUserLabel(adminUserById[e.paid_by_user_id])) : e.paid_by_other) || null;

  if (loading) return <p style={{ color: T.inkSoft }}>Loading…</p>;

  return (
    <div>
      <div className="flex justify-end mb-4"><Btn onClick={() => setAdding(true)}>+ Add expense</Btn></div>
      {expenses.length === 0 && <p style={{ color: T.inkSoft }}>No expenses recorded yet.</p>}
      <div className="grid gap-3">
        {expenses.map((e) => (
          <div key={e.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${T.terracotta}`, borderRadius: 8, padding: 14 }} className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark }}>{e.description}</div>
              <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                ${Number(e.amount).toFixed(2)} · {e.category} · {typeLabel(e)}
                {e.expense_type === "per_class" && classById[e.class_id] && ` (${classById[e.class_id].label})`}
                {" · from "}{e.start_date}{e.end_date ? ` to ${e.end_date}` : ""}
              </div>
              {paidByLabel(e) && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>Paid by {paidByLabel(e)}</div>}
              {e.notes && <div style={{ fontSize: 12, color: T.ink, marginTop: 4 }}>{e.notes}</div>}
              {e.receipt_path && (
                <button onClick={() => viewReceipt(e.receipt_path)} style={{ fontSize: 11, color: T.gold, textDecoration: "underline", marginTop: 4 }}>View receipt</button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setEditing(e)} style={{ fontSize: 13, fontWeight: 500, padding: "5px 12px", borderRadius: 999, border: `1px solid ${T.maroon}55`, background: "#fff", color: T.maroon }}>Edit</button>
              <button onClick={() => setConfirmRemove(e)} style={{ fontSize: 13, fontWeight: 500, padding: "5px 12px", borderRadius: 999, border: `1px solid ${T.terracotta}55`, background: "#fff", color: T.terracotta }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      {(adding || editing) && (
        <ExpenseModal initial={editing} classes={classes} adminUsers={adminUsers} onClose={() => { setAdding(false); setEditing(null); }} onSaved={() => { setAdding(false); setEditing(null); load(); }} />
      )}
      {confirmRemove && (
        <TypeToConfirmModal
          title="Delete this expense?"
          message={`Removing "${confirmRemove.description}" will exclude it from all future finance reports. This can't be undone.`}
          confirmString={confirmRemove.description}
          confirmLabel="Delete"
          onConfirm={() => doRemove(confirmRemove.id)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}
