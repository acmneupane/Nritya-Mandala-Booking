import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { LOGO_DATA_URI } from "../lib/logo";
import StudentsView from "./StudentsView";
import CalendarView from "./CalendarView";
import ClassesView from "./ClassesView";
import LevelsView from "./LevelsView";
import HistoryView from "./HistoryView";
import RequestsView from "./RequestsView";
import SettingsView from "./SettingsView";
import ShareEnrollLink from "./ShareEnrollLink";

const NAV = [
  { id: "calendar", label: "Calendar" },
  { id: "students", label: "Students", countKey: "students" },
  { id: "requests", label: "Requests", countKey: "requests", urgent: true },
  { id: "classes", label: "Classes", countKey: "classes" },
  { id: "levels", label: "Levels" },
  { id: "history", label: "History" },
  { id: "settings", label: "Settings" },
];

function NavBadge({ count, urgent }) {
  if (!count) return null;
  return (
    <span style={{
      marginLeft: "auto", fontSize: 11, fontWeight: 700, minWidth: 18, textAlign: "center",
      padding: "1px 6px", borderRadius: 999,
      background: urgent ? T.terracotta : "rgba(255,255,255,0.25)",
      color: urgent ? "#fff" : T.ivory,
    }}>
      {count}
    </span>
  );
}

export default function Dashboard() {
  // Calendar is the "homepage" — the first thing you see, showing what's happening
  // today/this week. Pending requests get their own always-visible badge in the nav
  // instead, so they're never missed regardless of which tab you land on.
  const [tab, setTab] = useState("calendar");
  const [menuOpen, setMenuOpen] = useState(false);
  const [counts, setCounts] = useState({ students: 0, classes: 0, requests: 0 });

  const loadCounts = useCallback(async () => {
    const [sRes, cRes, rRes] = await Promise.all([
      supabase.from("students").select("id", { count: "exact", head: true }).eq("archived", false),
      supabase.from("classes").select("id", { count: "exact", head: true }),
      supabase.from("enrollment_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    setCounts({ students: sRes.count || 0, classes: cRes.count || 0, requests: rRes.count || 0 });
  }, []);

  useEffect(() => { loadCounts(); }, [loadCounts]);
  // Cheap query, so just refresh whenever the tab changes — catches any count that
  // shifted while working elsewhere (e.g. approving a request, archiving a student).
  useEffect(() => { loadCounts(); }, [tab, loadCounts]);

  const goTo = (id) => { setTab(id); setMenuOpen(false); };

  return (
    <div style={{ minHeight: "100vh", background: T.paper, fontFamily: "Inter, sans-serif" }} className="md:flex">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between" style={{ background: T.maroon, padding: "12px 16px" }}>
        <div className="flex items-center gap-2">
          <img src={LOGO_DATA_URI} alt="" style={{ width: 28, height: 28, borderRadius: "50%" }} />
          <span style={{ fontFamily: "Fraunces, serif", fontSize: 15, color: T.ivory }}>Nritya Mandala</span>
        </div>
        <div className="flex items-center gap-2">
          {counts.requests > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, background: T.terracotta, color: "#fff", borderRadius: 999, padding: "2px 7px" }}>
              {counts.requests} pending
            </span>
          )}
          <button onClick={() => setMenuOpen((v) => !v)} style={{ color: T.ivory, fontSize: 22, padding: "4px 8px" }} aria-label="Menu">
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="md:hidden" style={{ background: T.maroonDark, padding: "8px 8px 12px" }}>
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => goTo(n.id)}
              className="flex items-center"
              style={{
                width: "100%", textAlign: "left", padding: "10px 14px", borderRadius: 6, fontSize: 14,
                background: tab === n.id ? T.goldLight : "transparent",
                color: tab === n.id ? T.maroonDark : T.ivory,
                fontWeight: tab === n.id ? 600 : 400,
              }}
            >
              {n.label}
              {n.countKey && <NavBadge count={counts[n.countKey]} urgent={n.urgent} />}
            </button>
          ))}
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ display: "block", width: "100%", textAlign: "left", marginTop: 8, fontSize: 13, color: T.ivory, opacity: 0.85, background: "transparent", border: `1px solid ${T.ivory}55`, borderRadius: 6, padding: "8px 14px" }}
          >
            Sign out
          </button>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:block" style={{ width: 190, background: T.maroon, padding: "24px 14px", flexShrink: 0 }}>
        <div className="flex items-center gap-2 mb-8 px-2">
          <img src={LOGO_DATA_URI} alt="" style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
          <span style={{ fontFamily: "Fraunces, serif", fontSize: 15, color: T.ivory, lineHeight: 1.15 }}>Nritya Mandala</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              style={{
                display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 6, fontSize: 13.5,
                background: tab === n.id ? T.goldLight : "transparent",
                color: tab === n.id ? T.maroonDark : T.ivory,
                fontWeight: tab === n.id ? 600 : 400, textAlign: "left",
              }}
            >
              {n.label}
              {n.countKey && <NavBadge count={counts[n.countKey]} urgent={n.urgent} />}
            </button>
          ))}
        </nav>
        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ fontSize: 13, color: T.ivory, opacity: 0.85, background: "transparent", border: `1px solid ${T.ivory}55`, borderRadius: 6, padding: "6px 12px" }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="md:flex-1" style={{ padding: "18px 14px", overflowX: "hidden", minWidth: 0 }}>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.maroonDark }}>
            {NAV.find((n) => n.id === tab)?.label}
          </h2>
          <ShareEnrollLink compact />
        </div>
        {tab === "students" && <StudentsView />}
        {tab === "calendar" && <CalendarView />}
        {tab === "requests" && <RequestsView />}
        {tab === "classes" && <ClassesView />}
        {tab === "levels" && <LevelsView />}
        {tab === "history" && <HistoryView />}
        {tab === "settings" && <SettingsView />}
      </main>
    </div>
  );
}
