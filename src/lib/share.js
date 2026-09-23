import { APP_ORIGIN } from "./origins";

// Web Share API opens the device's native share sheet (WhatsApp, Messages, Mail,
// etc.) — supported on mobile Safari/Chrome, not reliably on desktop browsers. Falls
// back to a WhatsApp Web link there instead, so the button still does something
// useful everywhere rather than silently failing on desktop.
//
// The link points straight at the enrolment form with ?ref=<code> attached, so a
// signup that comes through it can be credited to the referring family — see
// apply_referral_reward() in Supabase.
export function shareReferral(referrerCode) {
  const url = referrerCode ? `${APP_ORIGIN}/enroll?ref=${encodeURIComponent(referrerCode)}` : `${APP_ORIGIN}/enroll`;
  const text = "My kid loves dancing at Nritya Mandala! Check out their classes:";
  if (navigator.share) {
    navigator.share({ title: "Nritya Mandala", text, url }).catch(() => {});
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank");
  }
}
