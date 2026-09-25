import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { useLogoUrl } from "../lib/logo";
import StudentsView from "./StudentsView";
import CalendarView from "./CalendarView";
import ClassesView from "./ClassesView";
import LevelsView from "./LevelsView";
import HistoryView from "./HistoryView";
import RequestsView from "./RequestsView";
import AccountView from "./AccountView";
import StudioSettingsView from "./StudioSettingsView";
import WebsiteContentView from "./WebsiteContentView";
import ShareEnrollLink from "./ShareEnrollLink";
import PackageTiersView from "./PackageTiersView";
import RenewalsView from "./RenewalsView";
import FinancesView from "./FinancesView";
import HomeView from "./HomeView";
import AdminConfigView from "./AdminConfigView";
import FormsView from "./FormsView";
import { useMyAccess } from "../lib/permissions";

const NAV = [
  { id: "home", label: "Dashboard" },
  { id: "calendar", label: "Calendar" },
  { id: "students", label: "Students", countKey: "students" },
  { id: "requests", label: "New Requests", countKey: "requests", urgent: true },
  { id: "renewals", label: "Renewals", countKey: "renewals", urgent: true },
  { id: "classes", label: "Classes", countKey: "classes" },
  { id: "levels", label: "Levels" },
  { id: "packages", label: "Packages" },
  { id: "finances", label: "Finances" },
  { id: "history", label: "History" },
  { id: "website", label: "Website" },
  { id: "forms", label: "Forms", countKey: "forms" },
  { id: "studio-settings", label: "Studio Settings" },
  { id: "admin-config", label: "Admin Config" },
  { id: "account", label: "Account" },
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
  // Home is the landing page — a quick-glance summary of today's classes and what
  // needs attention. Pending requests get their own always-visible badge in the nav
  // instead, so they're never missed regardless of which tab you land on. A
  // ?request=<id> link (from the notification email) overrides this and jumps
  // straight to that request.
  const logoUrl = useLogoUrl();
  const focusRequestId = new URLSearchParams(window.location.search).get("request");
  const focusRenewalId = new URLSearchParams(window.location.search).get("renewal");
  const focusStudentCode = new URLSearchParams(window.location.search).get("student");
  const focusFormId = new URLSearchParams(window.location.search).get("form");
  const [tab, setTab] = useState(focusRequestId ? "requests" : focusRenewalId ? "renewals" : focusStudentCode ? "students" : focusFormId ? "forms" : "home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [counts, setCounts] = useState({ students: 0, classes: 0, requests: 0, renewals: 0, forms: 0 });
  const access = useMyAccess();

  const loadCounts = useCallback(async () => {
    const [sRes, cRes, rRes, renRes, studentsRes, pkgRes, formsRes] = await Promise.all([
      supabase.from("students").select("id", { count: "exact", head: true }).eq("archived", false),
      supabase.from("classes").select("id", { count: "exact", head: true }),
      supabase.from("enrollment_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("package_renewal_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("students").select("id").eq("archived", false),
      supabase.from("student_package_summary").select("student_id, classes_total, classes_used"),
      // New form responses (0 for anyone without the Studio Settings permission).
      supabase.from("form_responses").select("id", { count: "exact", head: true }).eq("status", "new"),
    ]);
    const pkgByStudent = Object.fromEntries((pkgRes.data || []).map((p) => [p.student_id, p]));
    const dueCount = (studentsRes.data || []).filter((s) => {
      const pkg = pkgByStudent[s.id];
      const hasPackage = pkg && pkg.classes_total > 0;
      if (!hasPackage) return true; // no package at all — e.g. freshly reactivated
      return (pkg.classes_total - pkg.classes_used) <= 2;
    }).length;
    setCounts({ students: sRes.count || 0, classes: cRes.count || 0, requests: rRes.count || 0, renewals: (renRes.count || 0) + dueCount, forms: formsRes.count || 0 });
  }, []);

  useEffect(() => { loadCounts(); }, [loadCounts]);
  // Cheap query, so just refresh whenever the tab changes — catches any count that
  // shifted while working elsewhere (e.g. approving a request, archiving a student).
  useEffect(() => { loadCounts(); }, [tab, loadCounts]);

  // A deep link (?request=/?renewal=/?student=) can point at a tab this user's
  // permissions don't actually unlock — once access finishes loading, fall back
  // to Home instead of rendering nothing.
  useEffect(() => {
    if (!access.loading && !access.canAccessTab(tab)) setTab("home");
  }, [access.loading, access, tab]);

  const goTo = (id) => { setTab(id); setMenuOpen(false); };

  if (access.loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }

  const visibleNav = NAV.filter((n) => access.canAccessTab(n.id));

  return (
    <div style={{ minHeight: "100vh", background: T.paper, fontFamily: "Inter, sans-serif" }} className="md:flex">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between" style={{ background: T.maroon, padding: "12px 16px" }}>
        <div className="flex items-center gap-2">
          <img src={logoUrl} alt="" style={{ width: 28, height: 28, borderRadius: "50%" }} />
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
          {visibleNav.map((n) => (
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
          <img src={logoUrl} alt="" style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
          <span style={{ fontFamily: "Fraunces, serif", fontSize: 15, color: T.ivory, lineHeight: 1.15 }}>Nritya Mandala</span>
        </div>
        <nav className="flex flex-col gap-1">
          {visibleNav.map((n) => (
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
            {visibleNav.find((n) => n.id === tab)?.label}
          </h2>
          <ShareEnrollLink compact />
        </div>
        {/* Guarded by canAccessTab, not just visibleNav hiding the link — the
            useEffect above bounces an inaccessible deep-linked tab back to
            "home", but this is the belt-and-braces check that actually stops
            the view from rendering even for a moment. */}
        {access.canAccessTab(tab) && tab === "students" && <StudentsView focusStudentCode={focusStudentCode} />}
        {access.canAccessTab(tab) && tab === "home" && <HomeView counts={counts} onNavigate={setTab} access={access} />}
        {access.canAccessTab(tab) && tab === "calendar" && <CalendarView access={access} />}
        {access.canAccessTab(tab) && tab === "requests" && <RequestsView focusRequestId={focusRequestId} />}
        {access.canAccessTab(tab) && tab === "renewals" && <RenewalsView focusRenewalId={focusRenewalId} />}
        {access.canAccessTab(tab) && tab === "classes" && <ClassesView />}
        {access.canAccessTab(tab) && tab === "levels" && <LevelsView />}
        {access.canAccessTab(tab) && tab === "packages" && <PackageTiersView />}
        {access.canAccessTab(tab) && tab === "finances" && <FinancesView />}
        {access.canAccessTab(tab) && tab === "history" && <HistoryView />}
        {access.canAccessTab(tab) && tab === "website" && <WebsiteContentView />}
        {access.canAccessTab(tab) && tab === "forms" && <FormsView focusFormId={focusFormId} />}
        {access.canAccessTab(tab) && tab === "studio-settings" && <StudioSettingsView />}
        {access.canAccessTab(tab) && tab === "admin-config" && <AdminConfigView />}
        {access.canAccessTab(tab) && tab === "account" && <AccountView />}
      </main>
    </div>
  );
}
