// Fixed footer appended to every "editable body" email (renewal reminder, renewal
// approval) after the admin's content — kept out of the editable template/textarea
// entirely so it can never be accidentally edited or deleted. Must stay in sync with
// the FOOTER_HTML constant duplicated in the corresponding Supabase edge functions
// (send-package-reminder-email, send-renewal-approval-email), since each runs in its
// own isolated Deno runtime and can't import from here.
export const EMAIL_FOOTER_HTML = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e6d3be;text-align:center;"><a href="https://www.facebook.com/profile.php?id=100095383322004" style="display:inline-block;background-color:#1877F2;color:#ffffff;padding:10px 22px;border-radius:6px;text-decoration:none;font-family:Arial,sans-serif;font-weight:600;font-size:14px;"><span style="display:inline-block;width:18px;height:18px;background-color:#ffffff;color:#1877F2;border-radius:50%;text-align:center;line-height:18px;font-weight:800;margin-right:8px;vertical-align:middle;font-family:Arial,sans-serif;">f</span><span style="vertical-align:middle;">Follow Nritya Mandala on Facebook</span></a></div>`;
