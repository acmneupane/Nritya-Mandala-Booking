import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { useLogoUrl } from "../lib/logo";
import FormRenderer from "./FormRenderer";

// /forms?code=CODE — a form built in Admin → Forms. get_public_form() returns
// null for an unknown or Draft code (sent to the homepage), just the title for
// a Closed one (short message), or the whole form when Open. &src= on the link
// (where it was shared, e.g. facebook) is saved with the response.
export default function PublicFormPage() {
  const logoUrl = useLogoUrl();
  const params = new URLSearchParams(window.location.search);
  const code = (params.get("code") || "").trim();
  const source = params.get("src") || null;
  const [form, setForm] = useState(undefined); // undefined = loading
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!code) { window.location.replace("/"); return; }
    supabase.rpc("get_public_form", { p_code: code }).then(({ data, error }) => {
      if (error) { setLoadError(true); return; }
      if (!data) { window.location.replace("/"); return; }
      setForm(data);
    });
  }, [code]);

  if (loadError) {
    return (
      <div style={{ minHeight: "100vh", background: T.ivory, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "Inter, sans-serif" }}>
        <p style={{ fontSize: 14, color: T.inkSoft, textAlign: "center" }}>Couldn't load this form — check your connection and refresh the page.</p>
      </div>
    );
  }

  if (!form) {
    return <div style={{ minHeight: "100vh", background: T.ivory, display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }

  if (form.status === "closed") {
    return (
      <div style={{ minHeight: "100vh", background: T.ivory, fontFamily: "Inter, sans-serif" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "56px 16px", textAlign: "center" }}>
          <img src={logoUrl} alt="Nritya Mandala" style={{ width: 64, height: 64, borderRadius: "50%", display: "block", margin: "0 auto 18px" }} />
          <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: T.maroonDark, fontWeight: 600, marginBottom: 10 }}>{form.title}</h1>
          <p style={{ fontSize: 15, color: T.ink, lineHeight: 1.6 }}>This form is no longer accepting responses. Thank you for your interest!</p>
          <a href="/" style={{ display: "inline-block", marginTop: 22, fontSize: 14, fontWeight: 600, color: T.gold }}>Visit Nritya Mandala →</a>
        </div>
      </div>
    );
  }

  return <FormRenderer form={form} source={source} />;
}
