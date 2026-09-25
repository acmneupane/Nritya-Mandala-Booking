import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "./lib/supabase";
import Login from "./components/Login";
import ParentLookup from "./components/ParentLookup";
import EnrollForm from "./components/EnrollForm";
import RenewForm from "./components/RenewForm";
import TransferRequestForm from "./components/TransferRequestForm";
import Dashboard from "./components/Dashboard";
import ComingSoonPage from "./components/ComingSoonPage";
import HomePage from "./components/HomePage";
import PolicyPage from "./components/PolicyPage";
import PublicFormPage from "./components/PublicFormPage";
import { T } from "./lib/theme";

// admin.nrityamandala.com is the same deployed app as app.nrityamandala.com — this
// is the one place that decides which experience a visitor gets, based on which
// domain they actually typed. localhost/127.0.0.1 (local dev) also gets the admin
// experience, for convenience while working on it.
const ADMIN_HOSTNAMES = ["admin.nrityamandala.com", "localhost", "127.0.0.1"];

// What the root path (and any unrecognised path) shows to a public visitor,
// controlled by the "Go live" toggle on the admin Website page (site_content's
// site_live key) — defaults to the coming-soon page until the studio flips it,
// so a fresh install never accidentally shows an empty/half-built homepage.
function PublicHomeGate() {
  const [live, setLive] = useState(undefined); // undefined = loading
  useEffect(() => {
    supabase.from("site_content").select("value").eq("key", "site_live").maybeSingle()
      .then(({ data }) => setLive(data?.value === "true"));
  }, []);
  if (live === undefined) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }
  return live ? <HomePage /> : <ComingSoonPage />;
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const path = window.location.pathname;
  const isAdminHost = ADMIN_HOSTNAMES.includes(window.location.hostname);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  // The installed mobile app (Capacitor) is parent-facing only. Its WebView is
  // served from "localhost", which the hostname check below would otherwise
  // treat as the admin host, so this has to come first. Always false in a
  // browser, so the website is unaffected. New enrolment deliberately has no
  // in-app route — links to it use the full app.nrityamandala.com URL, which
  // the app hands off to the phone's browser.
  if (Capacitor.isNativePlatform()) {
    if (path === "/renew" || path === "/renewal") return <RenewForm />;
    if (path === "/transfer") return <TransferRequestForm />;
    if (path === "/house-rules") return <PolicyPage contentKey="house_rules_html" title="House Rules" />;
    if (path === "/privacy") return <PolicyPage contentKey="privacy_policy_html" title="Privacy Policy" />;
    if (path === "/terms") return <PolicyPage contentKey="terms_conditions_html" title="Terms & Conditions" />;
    if (path === "/forms") return <PublicFormPage />;
    return <ParentLookup />;
  }

  if (!isAdminHost) {
    // Public-facing domain: the root (and anything unrecognised) is gated by the
    // "Go live" toggle — see PublicHomeGate above. /new always shows the real
    // homepage directly, live or not, so the studio can keep previewing/building
    // it before flipping the switch; /comingsoon always shows the placeholder,
    // for the same reason in reverse.
    if (path === "/parent") return <ParentLookup />;
    if (path === "/enroll") return <EnrollForm />;
    if (path === "/qr") return <ParentLookup />;
    if (path === "/renew" || path === "/renewal") return <RenewForm />;
    if (path === "/transfer") return <TransferRequestForm />;
    if (path === "/new") return <HomePage />;
    if (path === "/comingsoon") return <ComingSoonPage />;
    if (path === "/house-rules") return <PolicyPage contentKey="house_rules_html" title="House Rules" />;
    if (path === "/privacy") return <PolicyPage contentKey="privacy_policy_html" title="Privacy Policy" />;
    if (path === "/terms") return <PolicyPage contentKey="terms_conditions_html" title="Terms & Conditions" />;
    if (path === "/forms") return <PublicFormPage />;
    return <PublicHomeGate />;
  }

  // Admin domain: always the login/dashboard, regardless of path.
  if (session === undefined) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }

  if (!session) return <Login />;

  return <Dashboard />;
}
