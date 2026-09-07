import { useState } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { LOGO_DATA_URI } from "../lib/logo";
import { Btn } from "./ui";
import StudentsView from "./StudentsView";
import CalendarView from "./CalendarView";
import ClassesView from "./ClassesView";
import LevelsView from "./LevelsView";
import HistoryView from "./HistoryView";

const NAV = [
  { id: "calendar", label: "Calendar" },
  { id: "students", label: "Students" },
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

  return (
    <div style={{ minHeight: "100vh", background: T.paper, fontFamily: "Inter, sans-serif", display: "flex" }}>
      <aside style={{ width: 190, background: T.maroon, padding: "24px 14px", flexShrink: 0 }}>
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
      <main style={{ flex: 1, padding: "28px 32px", overflowX: "auto" }}>
        <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: T.maroonDark, marginBottom: 20 }}>
          {NAV.find((n) => n.id === tab)?.label}
        </h2>
        {tab === "students" && <StudentsView />}
        {tab === "calendar" && <CalendarView />}
        {tab === "classes" && <ClassesView />}
        {tab === "levels" && <LevelsView />}
        {tab === "history" && <HistoryView />}
        {tab === "settings" && <ComingSoon label="Settings" />}
      </main>
    </div>
  );
}
