import { useState } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { LOGO_DATA_URI } from "../lib/logo";
import StudentsView from "./StudentsView";
import CalendarView from "./CalendarView";
import ClassesView from "./ClassesView";
import LevelsView from "./LevelsView";
import HistoryView from "./HistoryView";
import RequestsView from "./RequestsView";

const NAV = [
  { id: "calendar", label: "Calendar" },
  { id: "students", label: "Students" },
  { id: "requests", label: "Requests" },
  { id: "classes", label: "Classes" },
  { id: "levels", label: "Levels" },
  { id: "history", label: "History" },
  { id: "settings", label: "Settings" },
];

function ComingSoon({ label }) {
  return (
    <div style={{ textAlign: "center", padding: "64px 0", color: T.inkSoft }}>
      <p>{label} — coming next.</p>
    </div>
  );
}

export default function Dashboard() {
  const [tab, setTab] = useState("students");
  const [menuOpen, setMenuOpen] = useState(false);

  const goTo = (id) => { setTab(id); setMenuOpen(false); };

  return (
    <div style={{ minHeight: "100vh", background: T.paper, fontFamily: "Inter, sans-serif" }} className="md:flex">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between" style={{ background: T.maroon, padding: "12px 16px" }}>
        <div className="flex items-center gap-2">
          <img src={LOGO_DATA_URI} alt="" style={{ width: 28, height: 28, borderRadius: "50%" }} />
          <span style={{ fontFamily: "Fraunces, serif", fontSize: 15, color: T.ivory }}>Nritya Mandala</span>
        </div>
        <button onClick={() => setMenuOpen((v) => !v)} style={{ color: T.ivory, fontSize: 22, padding: "4px 8px" }} aria-label="Menu">
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>
      {menuOpen && (
        <div className="md:hidden" style={{ background: T.maroonDark, padding: "8px 8px 12px" }}>
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => goTo(n.id)}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "10px 14px", borderRadius: 6, fontSize: 14,
                background: tab === n.id ? T.goldLight : "transparent",
                color: tab === n.id ? T.maroonDark : T.ivory,
                fontWeight: tab === n.id ? 600 : 400,
              }}
            >
              {n.label}
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
        <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.maroonDark, marginBottom: 16 }}>
          {NAV.find((n) => n.id === tab)?.label}
        </h2>
        {tab === "students" && <StudentsView />}
        {tab === "calendar" && <CalendarView />}
        {tab === "requests" && <RequestsView />}
        {tab === "classes" && <ClassesView />}
        {tab === "levels" && <LevelsView />}
        {tab === "history" && <HistoryView />}
        {tab === "settings" && <ComingSoon label="Settings" />}
      </main>
    </div>
  );
}
