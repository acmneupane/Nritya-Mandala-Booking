import { useState } from "react";
import { T, inputStyle } from "../lib/theme";
import { Btn, Field } from "./ui";

// A local (not-yet-saved) list of packages to create once a student exists — used
// both when adding a brand-new student and when approving an enrolment (where the
// student doesn't have an id yet either). The caller is responsible for actually
// inserting these into the packages table once the student row is created.
export default function PendingPackagesEditor({ pendingPackages, setPendingPackages }) {
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
