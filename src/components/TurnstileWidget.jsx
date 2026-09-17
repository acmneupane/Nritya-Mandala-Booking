import { useEffect, useRef } from "react";

// Turnstile's actual site key (public — safe to ship in the frontend bundle; the
// secret key that verifies it never leaves the submit-form edge function).
const SITE_KEY = "0x4AAAAAAE6N4_N9wQMgNgXe";

let scriptLoadPromise = null;
function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

// Renders Cloudflare's Turnstile widget (usually invisible/managed — most real
// visitors never see a puzzle) and reports the verification token up via onVerify.
// The token by itself proves nothing until the backend (submit-form edge function)
// checks it against Cloudflare's own server, so this component's only job is to
// get a fresh token and hand it off.
export default function TurnstileWidget({ onVerify }) {
  const containerRef = useRef(null);
  const widgetId = useRef(null);

  useEffect(() => {
    let mounted = true;
    loadTurnstileScript().then(() => {
      if (!mounted || !containerRef.current || widgetId.current) return;
      widgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: (token) => onVerify(token),
        "expired-callback": () => onVerify(""),
        "error-callback": () => onVerify(""),
      });
    });
    return () => {
      mounted = false;
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch { /* already gone */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} style={{ marginTop: 10, marginBottom: 10 }} />;
}
