import { APP_ORIGIN } from "./origins";

// Web Share API opens the device's native share sheet (WhatsApp, Messages, Mail,
// etc.) — supported on mobile Safari/Chrome, not reliably on desktop browsers. Falls
// back to a WhatsApp Web link there instead, so the button still does something
// useful everywhere rather than silently failing on desktop.
export function shareReferral() {
  const text = "My kid loves dancing at Nritya Mandala! Check out their classes:";
  if (navigator.share) {
    navigator.share({ title: "Nritya Mandala", text, url: APP_ORIGIN }).catch(() => {});
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${APP_ORIGIN}`)}`, "_blank");
  }
}
