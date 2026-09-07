import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import Login from "./components/Login";
import ParentLookup from "./components/ParentLookup";
import EnrollForm from "./components/EnrollForm";
import Dashboard from "./components/Dashboard";
import { T } from "./lib/theme";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const path = window.location.pathname;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (path === "/parent") return <ParentLookup />;
  if (path === "/enroll") return <EnrollForm />;

  if (session === undefined) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }

  if (!session) return <Login />;

  return <Dashboard />;
}
