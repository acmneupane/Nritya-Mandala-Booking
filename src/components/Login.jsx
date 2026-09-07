import { useState } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { LOGO_DATA_URI } from "../lib/logo";
import { Btn } from "./ui";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  };

  return (
    <div style={{ minHeight: "100vh", background: T.maroon, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: T.ivory, borderRadius: 12, padding: "40px 36px", width: 340, textAlign: "center" }}>
        <img src={LOGO_DATA_URI} alt="Nritya Mandala" style={{ width: 68, height: 68, borderRadius: "50%", margin: "0 auto 16px", display: "block" }} />
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: T.maroonDark, marginBottom: 4 }}>Nritya Mandala</h1>
        <p style={{ fontSize: 13, color: T.inkSoft, marginBottom: 24 }}>Studio sign-in</p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          style={{ ...inputStyle, marginBottom: 10, textAlign: "center" }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={{ ...inputStyle, marginBottom: 16, textAlign: "center" }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <Btn onClick={submit} size="lg" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Btn>
        <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 18 }}>
          <a href="/parent" style={{ color: T.gold, textDecoration: "underline" }}>Looking for your child's bookings?</a>
        </p>
      </div>
    </div>
  );
}
