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

// Computes revenue + expense totals (with itemized drill-down lists) for a date
// range. Revenue = confirmed package purchases + confirmed enrolment fee charges.
// Expenses = one-off (in range) + recurring occurrences (in range) + per-class
// sessions actually held (in range, respecting term dates and skipped classes).
async function computeFinances(rangeStart, rangeEnd) {
  const [pkgRes, feeRes, expRes, classRes, skipRes] = await Promise.all([
    supabase.from("packages").select("id, amount, purchase_date, notes, payment_confirmed, students(name)")
      .eq("payment_confirmed", true).gte("purchase_date", rangeStart).lte("purchase_date", rangeEnd),
    supabase.from("enrolment_fee_charges").select("id, amount, charged_at, is_sibling, students(name)")
      .eq("payment_confirmed", true).gte("charged_at", rangeStart).lte("charged_at", rangeEnd),
    supabase.from("expenses").select("*"),
    supabase.from("classes").select("*"),
    supabase.from("class_skips").select("class_id, date"),
  ]);

  const packages = pkgRes.data || [];
  const fees = feeRes.data || [];
  const packageRevenue = packages.reduce((sum, p) => sum + Number(p.amount), 0);
  const feeRevenue = fees.reduce((sum, f) => sum + Number(f.amount), 0);

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

  return {
    packageRevenue, feeRevenue, totalRevenue: packageRevenue + feeRevenue,
    packages, fees, expenseLines, totalExpenses,
    profit: packageRevenue + feeRevenue - totalExpenses,
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
  const [expanded, setExpanded] = useState(null); // 'revenue' | 'expenses' | null
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
        months.push({ label: d.toLocaleDateString(undefined, { month: "short" }), revenue: r.totalRevenue, expenses: r.totalExpenses });
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
          <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <button onClick={() => setExpanded(expanded === "revenue" ? null : "revenue")} style={{ textAlign: "left", background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${T.sage}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600 }}>TOTAL REVENUE</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: T.sage, fontFamily: "Fraunces, serif" }}>${data.totalRevenue.toFixed(2)}</div>
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
            </div>
          </div>

          {expanded === "revenue" && (
            <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft, marginBottom: 8 }}>Package purchases — ${data.packageRevenue.toFixed(2)}</div>
              {data.packages.length === 0 && <p style={{ fontSize: 12, color: T.inkSoft }}>None in this period.</p>}
              {data.packages.map((p) => (
                <div key={p.id} className="flex justify-between" style={{ fontSize: 12, padding: "4px 0", borderTop: `1px solid ${T.line}` }}>
                  <span>{p.students?.name || "Unknown"} — {p.notes || "Package"} ({p.purchase_date})</span>
                  <span style={{ fontWeight: 600 }}>${Number(p.amount).toFixed(2)}</span>
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
                <span style={{ color: T.inkSoft }}>Last 6 months</span>
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
