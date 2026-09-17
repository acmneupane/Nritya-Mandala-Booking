import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import Login from "./components/Login";
import ParentLookup from "./components/ParentLookup";
import EnrollForm from "./components/EnrollForm";
import RenewForm from "./components/RenewForm";
import TransferRequestForm from "./components/TransferRequestForm";
import Dashboard from "./components/Dashboard";
import ComingSoonPage from "./components/ComingSoonPage";
import { T } from "./lib/theme";

// admin.nrityamandala.com is the same deployed app as app.nrityamandala.com — this
// is the one place that decides which experience a visitor gets, based on which
// domain they actually typed. localhost/127.0.0.1 (local dev) also gets the admin
// experience, for convenience while working on it.
const ADMIN_HOSTNAMES = ["admin.nrityamandala.com", "localhost", "127.0.0.1"];

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const path = window.location.pathname;
  const isAdminHost = ADMIN_HOSTNAMES.includes(window.location.hostname);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!isAdminHost) {
    // Public-facing domain: the parent-facing forms/lookups work exactly as
    // before; anything else (including the root) is the coming-soon placeholder
    // until the real public homepage is built.
    if (path === "/parent") return <ParentLookup />;
    if (path === "/enroll") return <EnrollForm />;
    if (path === "/qr") return <ParentLookup />;
    if (path === "/renew" || path === "/renewal") return <RenewForm />;
    if (path === "/transfer") return <TransferRequestForm />;
    return <ComingSoonPage />;
  }

  // Admin domain: always the login/dashboard, regardless of path.
  if (session === undefined) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }

  if (!session) return <Login />;

  return <Dashboard />;
}
