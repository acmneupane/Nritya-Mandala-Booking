// admin.nrityamandala.com and app.nrityamandala.com are the same deployed bundle —
// App.jsx decides which experience to show purely from window.location.hostname.
// On the admin host, /parent, /qr, /renew, /transfer and /enroll never render (the
// admin host always shows the dashboard regardless of path), so any parent-facing
// link built from an admin-side screen must NOT use window.location.origin — that
// would produce a link back to the admin host, which just shows the dashboard
// instead of the intended page. Use this constant instead, everywhere such a link
// is built, regardless of which host the admin happens to be on.
export const APP_ORIGIN = "https://app.nrityamandala.com";
