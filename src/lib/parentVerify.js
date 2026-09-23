// Per-device "remembered" identity check for the parent/QR lookup page — see
// verify_student_dob() in Supabase for the actual check. Silent, no "remember
// me" choice: a successful verification is just remembered for 15 days on
// whichever device it happened on. There's no way to make this work across a
// parent's other devices without building real parent accounts, so a second
// phone or browser will always need to verify once too.
const STORAGE_KEY = "nm_parent_verified";
const REMEMBER_DAYS = 15;

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
    store[code] = Date.now() + REMEMBER_DAYS * 86400000;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Private browsing / storage disabled — verification just won't be
    // remembered next time, which is a worse experience, not a broken one.
  }
}
