import { APP_ORIGIN } from "./origins";

// Web Share API opens the device's native share sheet (WhatsApp, Messages, Mail,
// etc.) — supported on mobile Safari/Chrome, not reliably on desktop browsers. Falls
// back to a WhatsApp Web link there instead, so the button still does something
// useful everywhere rather than silently failing on desktop.
//
// The link points straight at the enrolment form with ?ref=<code> attached, so a
// signup that comes through it can be credited to the referring family — see
// apply_referral_reward() in Supabase.
// Turns the studio's referral config into the button label and, when the
// program's on, a supporting line — mentioning "they get one too" only when
// that toggle is actually on, since it's not true otherwise.
export function referralCopy(config) {
  if (!config?.referral_program_enabled) {
    return { buttonLabel: "📣 Refer a friend", detailLine: null };
  }
  const n = config.referrals_per_free_class || 1;
  const buttonLabel = n === 1 ? "📣 Refer and earn a free class!" : `📣 Refer ${n} friends, earn a free class!`;
  const youGet = n === 1 ? "You get 1 free class for every referral" : `You get 1 free class for every ${n} referrals`;
  const detailLine = config.referred_student_gets_free_class ? `${youGet} — and they get one too!` : youGet;
  return { buttonLabel, detailLine };
}

export function shareReferral(referrerCode) {
  const url = referrerCode ? `${APP_ORIGIN}/enroll?ref=${encodeURIComponent(referrerCode)}` : `${APP_ORIGIN}/enroll`;
  const text = "My kid loves dancing at Nritya Mandala! Check out their classes:";
  if (navigator.share) {
    navigator.share({ title: "Nritya Mandala", text, url }).catch(() => {});
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank");
  }
}
