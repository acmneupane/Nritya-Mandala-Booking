import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { localDateStr } from "../lib/dates";
import { occurrencesInRange } from "../lib/scheduling";
import ExpensesView from "./ExpensesView";

function monthBounds(year, month) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start: localDateStr(start), end: localDateStr(end) };
}

function intersect(aStart, aEnd, bStart, bEnd) {
  const start = aStart > bStart ? aStart : bStart;
  const end = (aEnd && aEnd < bEnd) ? aEnd : bEnd;
  if (start > end) return null;
  return { start, end };
}

function countWeekly(anchorStr, start, end) {
  let d = new Date(anchorStr + "T00:00:00");
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  while (d < s) d.setDate(d.getDate() + 7);
  let count = 0;
  while (d <= e) { count++; d.setDate(d.getDate() + 7); }
  return count;
}
function countMonthly(anchorStr, start, end) {
  let d = new Date(anchorStr + "T00:00:00");
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  while (d < s) d.setMonth(d.getMonth() + 1);
  let count = 0;
  while (d <= e) { count++; d.setMonth(d.getMonth() + 1); }
  return count;
}

// Revenue recognition: instead of counting a package's full price in the month it
// was bought, spread it across the classes as they're actually delivered. Each
// qualifying attendance record (attended, or missed with no 24hr notice — NOT
// skipped, and NOT a class the studio itself cancelled) recognizes one class's
// worth of revenue (package amount ÷ classes_total), dated to when it happened.
// When a student has bought multiple packages over time, consumption is FIFO —
// oldest package's classes get used up first. Only confirmed packages count.
async function computeRevenueEarned(rangeStart, rangeEnd) {
  const [pkgRes, attRes, skipRes, studentRes] = await Promise.all([
    supabase.from("packages").select("id, student_id, amount, classes_total, purchase_date").eq("payment_confirmed", true).lte("purchase_date", rangeEnd).order("purchase_date"),
    supabase.from("attendance").select("student_id, class_id, date, status").in("status", ["attended", "missed"]).lte("date", rangeEnd).order("date"),
    supabase.from("class_skips").select("class_id, date"),
    supabase.from("students").select("id, name"),
  ]);

  const skipSet = new Set((skipRes.data || []).map((s) => `${s.class_id}|${s.date}`));
  const studentById = Object.fromEntries((studentRes.data || []).map((s) => [s.id, s]));

  const pkgsByStudent = {};
  (pkgRes.data || []).forEach((p) => { (pkgsByStudent[p.student_id] ||= []).push(p); });

  const attByStudent = {};
  (attRes.data || []).forEach((a) => {
    if (skipSet.has(`${a.class_id}|${a.date}`)) return; // studio cancelled this session — never happened
    (attByStudent[a.student_id] ||= []).push(a);
  });

  const revenueLines = [];
  for (const [studentId, atts] of Object.entries(attByStudent)) {
    const pkgs = pkgsByStudent[studentId] || [];
    let pkgIdx = 0, usedInCurrent = 0;
    for (const a of atts) {
      while (pkgIdx < pkgs.length && usedInCurrent >= pkgs[pkgIdx].classes_total) { pkgIdx++; usedInCurrent = 0; }
      if (pkgIdx >= pkgs.length) break; // more classes attended than paid for — nothing left to recognize
      const pkg = pkgs[pkgIdx];
      const perClass = pkg.classes_total > 0 ? Number(pkg.amount) / pkg.classes_total : 0;
      usedInCurrent++;
      if (a.date >= rangeStart && a.date <= rangeEnd) {
        revenueLines.push({ studentId, studentName: studentById[studentId]?.name || "Unknown", date: a.date, amount: perClass });
      }
    }
  }
  return revenueLines;
}

async function computeFinances(rangeStart, rangeEnd) {
  const [revenueLines, feeRes, pkgCashRes, expRes, classRes, skipRes] = await Promise.all([
    computeRevenueEarned(rangeStart, rangeEnd),
    supabase.from("enrolment_fee_charges").select("id, amount, charged_at, is_sibling, students(name)")
      .eq("payment_confirmed", true).gte("charged_at", rangeStart).lte("charged_at", rangeEnd),
    supabase.from("packages").select("id, student_id, amount, purchase_date, notes, students(name)")
      .eq("payment_confirmed", true).gte("purchase_date", rangeStart).lte("purchase_date", rangeEnd),
    supabase.from("expenses").select("*"),
    supabase.from("classes").select("*"),
    supabase.from("class_skips").select("class_id, date"),
  ]);

  const fees = feeRes.data || [];
  const feeRevenue = fees.reduce((sum, f) => sum + Number(f.amount), 0);
  const packageRevenueEarned = revenueLines.reduce((sum, l) => sum + l.amount, 0);
  const packagesCash = pkgCashRes.data || [];
  const cashCollected = packagesCash.reduce((sum, p) => sum + Number(p.amount), 0) + feeRevenue;

  const classById = Object.fromEntries((classRes.data || []).map((c) => [c.id, c]));
  const skips = skipRes.data || [];

  const expenseLines = [];
  for (const e of expRes.data || []) {
    if (e.expense_type === "one_off") {
      if (e.start_date >= rangeStart && e.start_date <= rangeEnd) {
        expenseLines.push({ expense: e, occurrences: 1, total: Number(e.amount) });
      }
    } else if (e.expense_type === "recurring") {
      const range = intersect(e.start_date, e.end_date, rangeStart, rangeEnd);
      if (range) {
        const n = e.recurrence === "weekly" ? countWeekly(e.start_date, range.start, range.end) : countMonthly(e.start_date, range.start, range.end);
        if (n > 0) expenseLines.push({ expense: e, occurrences: n, total: n * Number(e.amount) });
      }
    } else if (e.expense_type === "per_class") {
      const cls = classById[e.class_id];
      const range = intersect(e.start_date, e.end_date, rangeStart, rangeEnd);
      if (cls && range) {
        const n = occurrencesInRange(cls, skips, localDateStr, range.start, range.end);
        if (n > 0) expenseLines.push({ expense: e, occurrences: n, total: n * Number(e.amount), className: cls.label });
      }
    }
  }
  const totalExpenses = expenseLines.reduce((sum, l) => sum + l.total, 0);
  const totalRevenueEarned = packageRevenueEarned + feeRevenue;

  return {
    packageRevenueEarned, feeRevenue, totalRevenueEarned, cashCollected,
    revenueLines, fees, packagesCash, expenseLines, totalExpenses,
    profit: totalRevenueEarned - totalExpenses,
  };
}

function MiniBarChart({ months }) {
  const max = Math.max(1, ...months.map((m) => Math.max(m.revenue, m.expenses)));
  const w = 560, h = 160, barW = Math.min(28, (w / months.length) / 2.4);
  return (
    <svg viewBox={`0 0 ${w} ${h + 24}`} style={{ width: "100%", maxWidth: w }}>
      {months.map((m, i) => {
        const groupW = w / months.length;
        const x = i * groupW + groupW / 2;
        const revH = (m.revenue / max) * h;
        const expH = (m.expenses / max) * h;
        return (
          <g key={m.label}>
            <rect x={x - barW - 2} y={h - revH} width={barW} height={revH} fill={T.sage} rx={2} />
            <rect x={x + 2} y={h - expH} width={barW} height={expH} fill={T.terracotta} rx={2} />
            <text x={x} y={h + 16} textAnchor="middle" fontSize="10" fill={T.inkSoft}>{m.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function FinancesView() {
  const [section, setSection] = useState("overview");
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [allTime, setAllTime] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null); // 'revenue' | 'cash' | 'expenses' | null
  const [trend, setTrend] = useState([]);

  const rangeLabel = allTime
    ? "All Time"
    : new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const load = useCallback(async () => {
    setLoading(true);
    setExpanded(null);
    const { start, end } = allTime ? { start: "2000-01-01", end: localDateStr(new Date()) } : monthBounds(cursor.year, cursor.month);
    const result = await computeFinances(start, end);
    setData(result);
    setLoading(false);
  }, [cursor, allTime]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (allTime) return;
    (async () => {
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(cursor.year, cursor.month - i, 1);
        const { start, end } = monthBounds(d.getFullYear(), d.getMonth());
        const r = await computeFinances(start, end);
        months.push({ label: d.toLocaleDateString(undefined, { month: "short" }), revenue: r.totalRevenueEarned, expenses: r.totalExpenses });
      }
      setTrend(months);
    })();
  }, [cursor, allTime]);

  if (section === "expenses") {
    return (
      <div>
        <div className="flex gap-1 mb-4" style={{ background: T.paper, borderRadius: 8, padding: 3, display: "inline-flex" }}>
          <button onClick={() => setSection("overview")} style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, background: "transparent", color: T.inkSoft }}>Overview</button>
          <button onClick={() => setSection("expenses")} style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, background: "#fff", color: T.maroonDark, fontWeight: 600 }}>Expenses</button>
        </div>
        <ExpensesView />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex gap-1" style={{ background: T.paper, borderRadius: 8, padding: 3, display: "inline-flex" }}>
          <button style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, background: "#fff", color: T.maroonDark, fontWeight: 600 }}>Overview</button>
          <button onClick={() => setSection("expenses")} style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, background: "transparent", color: T.inkSoft }}>Expenses</button>
        </div>
        <div className="flex items-center gap-2">
          {!allTime && (
            <>
              <button onClick={() => setCursor((c) => { const d = new Date(c.year, c.month - 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; })} style={{ color: T.maroon, fontSize: 13 }}>← Prev</button>
              <span style={{ fontSize: 14, fontWeight: 600, color: T.maroonDark, minWidth: 130, textAlign: "center" }}>{rangeLabel}</span>
              <button onClick={() => setCursor((c) => { const d = new Date(c.year, c.month + 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; })} style={{ color: T.maroon, fontSize: 13 }}>Next →</button>
            </>
          )}
          <button
            onClick={() => setAllTime((v) => !v)}
            style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 999, border: `1px solid ${T.gold}`, background: allTime ? T.gold : "#fff", color: allTime ? T.maroonDark : T.gold }}
          >
            All Time
          </button>
        </div>
      </div>

      {loading || !data ? (
        <p style={{ color: T.inkSoft }}>Loading…</p>
      ) : (
        <>
          <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <button onClick={() => setExpanded(expanded === "revenue" ? null : "revenue")} style={{ textAlign: "left", background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${T.sage}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600 }}>REVENUE EARNED</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: T.sage, fontFamily: "Fraunces, serif" }}>${data.totalRevenueEarned.toFixed(2)}</div>
              <div style={{ fontSize: 11, color: T.inkSoft }}>{expanded === "revenue" ? "Hide breakdown ▾" : "Show breakdown ▸"}</div>
            </button>
            <button onClick={() => setExpanded(expanded === "expenses" ? null : "expenses")} style={{ textAlign: "left", background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${T.terracotta}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600 }}>TOTAL EXPENSES</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: T.terracotta, fontFamily: "Fraunces, serif" }}>${data.totalExpenses.toFixed(2)}</div>
              <div style={{ fontSize: 11, color: T.inkSoft }}>{expanded === "expenses" ? "Hide breakdown ▾" : "Show breakdown ▸"}</div>
            </button>
            <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${T.gold}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600 }}>PROFIT / LOSS</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: data.profit >= 0 ? T.sage : T.terracotta, fontFamily: "Fraunces, serif" }}>
                {data.profit >= 0 ? "+" : "-"}${Math.abs(data.profit).toFixed(2)}
              </div>
              <div style={{ fontSize: 11, color: T.inkSoft }}>Revenue earned − expenses</div>
            </div>
          </div>

          <button onClick={() => setExpanded(expanded === "cash" ? null : "cash")} style={{ textAlign: "left", width: "100%", background: T.paper, border: `1px dashed ${T.line}`, borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: T.inkSoft }}>
              Cash actually collected this period (full package + fee amounts, not spread out): <strong style={{ color: T.ink }}>${data.cashCollected.toFixed(2)}</strong>
              {" · "}{expanded === "cash" ? "Hide ▾" : "Show ▸"}
            </span>
          </button>

          {expanded === "revenue" && (
            <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft, marginBottom: 8 }}>Package classes delivered — ${data.packageRevenueEarned.toFixed(2)}</div>
              {data.revenueLines.length === 0 && <p style={{ fontSize: 12, color: T.inkSoft }}>None in this period.</p>}
              {data.revenueLines.map((l, i) => (
                <div key={i} className="flex justify-between" style={{ fontSize: 12, padding: "4px 0", borderTop: `1px solid ${T.line}` }}>
                  <span>{l.studentName} — class on {l.date}</span>
                  <span style={{ fontWeight: 600 }}>${l.amount.toFixed(2)}</span>
                </div>
              ))}
              <div style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft, marginTop: 14, marginBottom: 8 }}>Enrolment fees — ${data.feeRevenue.toFixed(2)}</div>
              {data.fees.length === 0 && <p style={{ fontSize: 12, color: T.inkSoft }}>None in this period.</p>}
              {data.fees.map((f) => (
                <div key={f.id} className="flex justify-between" style={{ fontSize: 12, padding: "4px 0", borderTop: `1px solid ${T.line}` }}>
                  <span>{f.students?.name || "Unknown"} — {f.is_sibling ? "sibling fee" : "enrolment fee"} ({f.charged_at})</span>
                  <span style={{ fontWeight: 600 }}>${Number(f.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {expanded === "cash" && (
            <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft, marginBottom: 8 }}>Package purchases (cash basis)</div>
              {data.packagesCash.length === 0 && <p style={{ fontSize: 12, color: T.inkSoft }}>None in this period.</p>}
              {(() => {
                const byStudent = {};
                data.packagesCash.forEach((p) => {
                  const key = p.student_id || "unknown";
                  (byStudent[key] ||= { name: p.students?.name || "Unknown", packages: [], total: 0 }).packages.push(p);
                  byStudent[key].total += Number(p.amount);
                });
                return Object.entries(byStudent).map(([studentId, group]) => (
                  <div key={studentId} style={{ marginTop: 10 }}>
                    <div className="flex justify-between" style={{ fontSize: 12, fontWeight: 700, color: T.maroonDark, padding: "4px 0", borderTop: `2px solid ${T.line}` }}>
                      <span>{group.name}</span>
                      <span>${group.total.toFixed(2)}</span>
                    </div>
                    {group.packages.map((p) => (
                      <div key={p.id} className="flex justify-between" style={{ fontSize: 12, color: T.inkSoft, padding: "3px 0 3px 12px" }}>
                        <span>{p.notes || "Package"} ({p.purchase_date})</span>
                        <span>${Number(p.amount).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ));
              })()}
            </div>
          )}

          {expanded === "expenses" && (
            <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
              {data.expenseLines.length === 0 && <p style={{ fontSize: 12, color: T.inkSoft }}>No expenses in this period.</p>}
              {data.expenseLines.map((l) => (
                <div key={l.expense.id} className="flex justify-between" style={{ fontSize: 12, padding: "5px 0", borderTop: `1px solid ${T.line}` }}>
                  <span>
                    {l.expense.description} ({l.expense.category})
                    {l.occurrences > 1 && ` · ${l.occurrences}× $${Number(l.expense.amount).toFixed(2)}`}
                    {l.className && ` — ${l.className}`}
                  </span>
                  <span style={{ fontWeight: 600 }}>${l.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {!allTime && trend.length > 0 && (
            <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 16 }}>
              <div className="flex items-center gap-4 mb-2" style={{ fontSize: 12 }}>
                <span style={{ color: T.inkSoft }}>Last 6 months (revenue earned, not cash collected)</span>
                <span className="flex items-center gap-1"><span style={{ width: 10, height: 10, background: T.sage, borderRadius: 2, display: "inline-block" }} /> Revenue</span>
                <span className="flex items-center gap-1"><span style={{ width: 10, height: 10, background: T.terracotta, borderRadius: 2, display: "inline-block" }} /> Expenses</span>
              </div>
              <MiniBarChart months={trend} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
