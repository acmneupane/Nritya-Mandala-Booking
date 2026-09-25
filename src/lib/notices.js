// Studio notice helpers. New notices are HTML from the admin rich-text
// editor; older ones were plain text, which is escaped and keeps its line
// breaks. Same trust level as the other admin-authored HTML in the app (only
// an admin with studio settings permission can write notices).
function looksLikeHtml(text) {
  return /<\/?[a-z][^>]*>/i.test(text);
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function noticeHtml(message) {
  const text = message || "";
  return looksLikeHtml(text) ? text : escapeHtml(text).replace(/\n/g, "<br/>");
}

// True when the editor's HTML has something in it besides empty paragraphs.
export function noticeHasText(message) {
  return (message || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
}

// Where a notice is shown, for the admin side, e.g. "Public homepage · Parent page".
export function noticeAudienceLabel(n) {
  const places = [];
  if (n.show_on_public !== false) places.push("Public homepage");
  if (n.show_on_parent !== false) places.push("Parent page & app");
  return places.length ? places.join(" · ") : "Staff dashboard only";
}

