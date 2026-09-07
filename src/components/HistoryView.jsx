import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";

const TABLE_LABELS = { students: "Students", classes: "Classes", levels: "Levels" };
const ACTION_COLOR = { insert: T.sage, update: T.gold, delete: T.terracotta };
const ACTION_LABEL = { insert: "Added", update: "Updated", delete: "Deleted" };

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function HistoryView() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTable, setFilterTable] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
    setEntries(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filterTable === "all" ? entries : entries.filter((e) => e.table_name === filterTable);

  if (loading) return <p style={{ color: T.inkSoft }}>Loading…</p>;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {["all", "students", "classes", "levels"].map((t) => (
          <button
            key={t}
            onClick={() => setFilterTable(t)}
            style={{
              fontSize: 12, padding: "5px 12px", borderRadius: 999,
              background: filterTable === t ? T.maroon : "#fff",
              color: filterTable === t ? T.ivory : T.inkSoft,
              border: `1px solid ${filterTable === t ? T.maroon : T.line}`,
              fontWeight: filterTable === t ? 600 : 400,
            }}
          >
            {t === "all" ? "All" : TABLE_LABELS[t]}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <p style={{ color: T.inkSoft }}>No history yet.</p>}

      <div className="grid gap-2">
        {filtered.map((e) => (
          <div key={e.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", background: "#fff", border: `1px solid ${T.line}`, borderLeft: `3px solid ${ACTION_COLOR[e.action]}`, borderRadius: 6, padding: "10px 12px" }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{e.summary}</span>
              <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
                {ACTION_LABEL[e.action]} · {TABLE_LABELS[e.table_name] || e.table_name} · {e.actor_email || "Unknown user"}
              </div>
            </div>
            <span style={{ fontSize: 11, color: T.inkSoft, whiteSpace: "nowrap", marginLeft: 12 }}>{timeAgo(e.created_at)}</span>
          </div>
        ))}
      </div>
      {entries.length === 200 && <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 10 }}>Showing the most recent 200 entries.</p>}
    </div>
  );
}
