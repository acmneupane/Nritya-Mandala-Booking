// Per-device "remembered" identity check for the parent/QR lookup page — see
// verify_student_dob() in Supabase for the actual check. Silent, no "remember
// me" choice: a successful verification is just remembered for 15 days on
// whichever device it happened on. There's no way to make this work across a
// parent's other devices without building real parent accounts, so a second
// phone or browser will always need to verify once too.
//
// Inside the mobile app the check never expires, and the app also remembers
// which code was used so it can open straight to the family's page on launch
// (see getRememberedCode below). The website keeps the 15-day window.
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const STORAGE_KEY = "nm_parent_verified";
const REMEMBER_DAYS = 15;
const REMEMBERED_CODE_KEY = "nm_remembered_code";

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function isVerified(code) {
  const store = readStore();
  const until = store[code];
  return typeof until === "number" && until > Date.now();
}

export function markVerified(code) {
  try {
    const store = readStore();
    store[code] = Capacitor.isNativePlatform() ? Number.MAX_SAFE_INTEGER : Date.now() + REMEMBER_DAYS * 86400000;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Private browsing / storage disabled — verification just won't be
    // remembered next time, which is a worse experience, not a broken one.
  }
}

// App only: the code a parent last verified with on this phone. Kept in the
// app's native storage (Preferences), which the OS doesn't clear the way it
// can clear a WebView's localStorage. Always null on the website.
export async function getRememberedCode() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    // Launch waits on this, so never let it hang: after 3s just show the
    // code entry screen.
    const timeout = new Promise((resolve) => setTimeout(() => resolve({ value: null }), 3000));
    const { value } = await Promise.race([Preferences.get({ key: REMEMBERED_CODE_KEY }), timeout]);
    return value || null;
  } catch {
    return null;
  }
}

export async function rememberCode(code) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Preferences.set({ key: REMEMBERED_CODE_KEY, value: code });
  } catch {
    // Not remembered — the parent just types the code again next launch.
  }
}

export async function forgetRememberedCode() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Preferences.remove({ key: REMEMBERED_CODE_KEY });
  } catch {
    // Nothing to do.
  }
}
