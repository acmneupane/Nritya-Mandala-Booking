import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { useLogoUrl } from "../lib/logo";
import { Btn } from "./ui";
import ParentView from "./ParentView";
import FamilyView from "./FamilyView";
import QrScanner from "./QrScanner";
import { isVerified, markVerified, getRememberedCode, rememberCode, forgetRememberedCode } from "../lib/parentVerify";
import { APP_ORIGIN } from "../lib/origins";

// Inside the mobile app, the lookup screen only shows the first time (or after
// "Look up a different code"): the verified code is remembered on the phone
// and reopened on every launch, and there's a Scan QR code button. The website
// behaves exactly as before.
const isApp = Capacitor.isNativePlatform();

// First name plus a last initial — enough for a parent to recognize their own
// kid without a stranger who only has the code learning the full name.
function maskName(name) {
  const parts = (name || "").trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] || "";
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function VerifyIdentity({ student, onVerified, onBack }) {
  const logoUrl = useLogoUrl();
  const [dob, setDob] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    if (!dob) return;
    setChecking(true);
    setError("");
    const { data: ok } = await supabase.rpc("verify_student_dob", { p_code: student.code, p_dob: dob });
    setChecking(false);
    if (ok) {
      markVerified(student.code);
      onVerified();
    } else {
      setError("Those details don't match — check with the studio if you're not sure.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: T.maroon, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: T.ivory, borderRadius: 12, padding: "40px 36px", width: 340, textAlign: "center" }}>
        <img src={logoUrl} alt="Nritya Mandala" style={{ width: 64, height: 64, borderRadius: "50%", display: "block", margin: "0 auto 16px" }} />
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.maroonDark, marginBottom: 6 }}>Confirm it's you</h1>
        <p style={{ fontSize: 13, color: T.inkSoft, marginBottom: 20, lineHeight: 1.5 }}>
          For <strong>{maskName(student.name)}</strong>, please confirm their date of birth to continue.
        </p>
        <input
          type="date"
          value={dob}
          onChange={(e) => { setDob(e.target.value); setError(""); }}
          style={{ ...inputStyle, textAlign: "center", marginBottom: 16 }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
        />
        {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <Btn onClick={submit} size="lg" disabled={checking || !dob}>{checking ? "Checking…" : "Confirm"}</Btn>
        <div style={{ marginTop: 14 }}>
          <button onClick={onBack} style={{ fontSize: 12, color: T.inkSoft, textDecoration: "underline" }}>Back</button>
        </div>
      </div>
    </div>
  );
}

export default function ParentLookup() {
  const logoUrl = useLogoUrl();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [archived, setArchived] = useState(false);
  const [student, setStudent] = useState(null);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  // The student whose code resolved the lookup — the family list's anchor,
  // and who VerifyIdentity checks a DOB against. Not necessarily who's shown:
  // family (once loaded) decides whether that's this page directly or the
  // family summary first.
  const [family, setFamily] = useState(null); // null = not loaded yet
  const [familyLoading, setFamilyLoading] = useState(false);
  const [activeStudent, setActiveStudent] = useState(null); // which child's full page is open, if any
  // App only: true while checking for a remembered code at launch, so the
  // code entry screen doesn't flash up before the family page opens.
  const [restoring, setRestoring] = useState(() => isApp && !new URLSearchParams(window.location.search).get("code"));
  const [showScanner, setShowScanner] = useState(false);

  // trusted: a code the app remembered after an earlier DOB check on this
  // phone — no need to ask again.
  const selectStudent = (data, trusted = false) => {
    setStudent(data);
    setFamily(null);
    setActiveStudent(null);
    setVerified(trusted || isVerified(data.code));
  };

  // Once verified, load who else shares this family (same guardians) — a
  // household with more than one child lands on the family summary first;
  // a household with just this one goes straight to their page, same as
  // before. Verifying one child's DOB is treated as proof for the whole
  // family, on this device, so every sibling's code is remembered too —
  // no reason to make a parent re-verify per kid.
  useEffect(() => {
    if (!verified || !student) return;
    setFamilyLoading(true);
    supabase.rpc("get_family_students", { p_code: student.code }).then(({ data }) => {
      const members = data && data.length > 0 ? data : [student];
      members.forEach((m) => markVerified(m.code));
      rememberCode(student.code);
      setFamily(members);
      setFamilyLoading(false);
    });
  }, [verified, student]);

  // fromMemory: the code the app remembered. If it's no longer valid it's
  // forgotten, but a connection problem keeps it so the next launch retries.
  const lookup = async (rawCode, { trusted = false, fromMemory = false } = {}) => {
    setError("");
    setArchived(false);
    setLoading(true);
    const { data, error: lookupError } = await supabase
      .from("student_public")
      .select("id, code, name, level_id")
      .eq("code", rawCode.trim().toUpperCase())
      .maybeSingle();
    if (data) {
      setLoading(false);
      selectStudent(data, trusted);
      return;
    }
    const { data: status, error: statusError } = lookupError
      ? { data: null, error: lookupError }
      : await supabase.rpc("check_student_code", { p_code: rawCode.trim() });
    setLoading(false);
    if (fromMemory) setCode(rawCode);
    if (statusError) {
      setError("Couldn't connect — check your internet connection and try again.");
      return;
    }
    if (fromMemory) forgetRememberedCode();
    if (status === "archived") {
      setArchived(true);
    } else {
      setError("Code not found — check with the studio.");
    }
  };

  // A QR scan lands here with ?code=XXXX already filled in — skip the typing
  // step. Otherwise, in the app, reopen the code remembered on this phone.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qCode = params.get("code");
    if (qCode) { setCode(qCode); lookup(qCode); return; }
    if (!isApp) return;
    getRememberedCode().then(async (saved) => {
      if (saved) await lookup(saved, { trusted: true, fromMemory: true });
      setRestoring(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = () => lookup(code);

  // Stable so the scanner doesn't restart the camera on every render; lookup
  // only touches state setters and supabase, so the first render's copy is fine.
  const onScanned = useCallback((scannedCode) => {
    setShowScanner(false);
    setCode(scannedCode);
    lookup(scannedCode);
    return { ok: true, message: "" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (restoring) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft }}>Loading…</div>;
  }

  if (student && !verified) {
    return (
      <VerifyIdentity
        student={student}
        onVerified={() => setVerified(true)}
        onBack={() => { setStudent(null); setVerified(false); }}
      />
    );
  }

  const resetToLookup = () => { forgetRememberedCode(); setStudent(null); setVerified(false); setFamily(null); setActiveStudent(null); };

  if (student && verified) {
    if (familyLoading || family === null) {
      return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft }}>Loading…</div>;
    }
    if (family.length > 1 && !activeStudent) {
      return <FamilyView students={family} usedCode={student.code} onSelectStudent={setActiveStudent} onLookupDifferent={resetToLookup} />;
    }
    return (
      <ParentView
        student={activeStudent || student}
        onBack={resetToLookup}
        onBackToFamily={family.length > 1 ? () => setActiveStudent(null) : undefined}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.maroon, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: T.ivory, borderRadius: 12, padding: "40px 36px", width: 340, textAlign: "center" }}>
        <a href="/" className="hover:opacity-90 transition-opacity" style={{ display: "inline-block", marginBottom: 16 }}>
          <img src={logoUrl} alt="Nritya Mandala" style={{ width: 80, height: 80, borderRadius: "50%", display: "block" }} />
        </a>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: T.maroonDark, marginBottom: 4 }}>Nritya Mandala</h1>
        <p style={{ fontSize: 13, color: T.inkSoft, marginBottom: 24 }}>Enter your student's code to see their bookings</p>
        <input
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(""); setArchived(false); }}
          placeholder="Code"
          style={{ ...inputStyle, textAlign: "center", letterSpacing: 4, fontSize: 18, textTransform: "uppercase", marginBottom: 16 }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
        />
        {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 12 }}>{error}</p>}
        {archived && (
          <div style={{ background: `${T.gold}18`, border: `1px solid ${T.gold}55`, borderRadius: 8, padding: "12px 14px", marginBottom: 16, textAlign: "left" }}>
            <p style={{ fontSize: 13, color: T.ink, lineHeight: 1.5, marginBottom: 8 }}>
              🪷 Looks like you've taken a break from dancing with us! We'd love to have you back — head over to re-enrol and we'll get you set up again.
            </p>
            <a href={`${APP_ORIGIN}/enroll`} style={{ fontSize: 13, color: T.gold, fontWeight: 600, textDecoration: "underline" }}>Re-enrol here</a>
          </div>
        )}
        <Btn onClick={submit} size="lg" disabled={loading}>{loading ? "Looking up…" : "View"}</Btn>
        {isApp && (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10 }}>or</p>
            <Btn variant="ghost" size="lg" onClick={() => setShowScanner(true)} disabled={loading}>📷 Scan QR code</Btn>
          </div>
        )}
      </div>
      {showScanner && (
        <QrScanner
          title="Scan your QR code"
          hint="Point the camera at the QR code on your student card"
          cameraErrorMessage="Couldn't open the camera — allow camera access for Nritya Mandala in your phone's Settings, or type the code instead."
          onDetected={onScanned}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
