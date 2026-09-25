import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export const ALL_PERMISSIONS = [
  { key: "finance", label: "Finance" },
  { key: "students", label: "Students" },
  { key: "requests_renewals", label: "Requests & Renewals" },
  { key: "instructor", label: "Instructor" },
  { key: "website", label: "Website Manager" },
  { key: "studio_settings", label: "Studio Settings" },
];

// Which permission(s) unlock each nav tab — matches the RLS policies applied to
// the tables each tab reads/writes. null means every logged-in admin user sees
// it regardless of permissions (Home, Account). Admin bypasses this entirely.
const TAB_PERMISSIONS = {
  home: null,
  account: null,
  calendar: ["students", "instructor"],
  students: ["students"],
  requests: ["requests_renewals"],
  renewals: ["requests_renewals"],
  classes: ["studio_settings"],
  levels: ["students", "studio_settings"],
  packages: ["studio_settings"],
  finances: ["finance"],
  // History (email log + audit log) is admin-only, like Admin Config.
  history: "ADMIN_ONLY",
  website: ["website"],
  forms: ["studio_settings"],
  "studio-settings": ["studio_settings"],
  // "ADMIN_ONLY" is a sentinel, not a permission name — no permission ever
  // satisfies it, only the is_admin flag. Capacity, email limits/templates,
  // renewal reminder config, and managing everyone else's access (folded in
  // here as the Team section) all stay admin-exclusive regardless of how many
  // permissions someone holds.
  "admin-config": "ADMIN_ONLY",
};

// Fetches the logged-in admin's access once per mount — Dashboard is the root of
// the authenticated experience, so this runs once there rather than needing a
// separate context provider at this app's scale. A permission change made from
// the Team screen (or directly in Supabase) takes effect the next time this
// remounts — i.e. their next login or page reload — not mid-session.
export function useMyAccess() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [permissions, setPermissions] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const [auRes, upRes] = await Promise.all([
        supabase.from("admin_users").select("is_admin").eq("id", user.id).maybeSingle(),
        supabase.from("user_permissions").select("permission").eq("user_id", user.id),
      ]);
      if (cancelled) return;
      setIsAdmin(!!auRes.data?.is_admin);
      setPermissions(new Set((upRes.data || []).map((r) => r.permission)));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const has = (perm) => isAdmin || permissions.has(perm);
  const canAccessTab = (tabId) => {
    const required = TAB_PERMISSIONS[tabId];
    if (required === "ADMIN_ONLY") return isAdmin;
    return isAdmin || required === null || required === undefined || required.some((p) => permissions.has(p));
  };

  return { loading, isAdmin, permissions, has, canAccessTab };
}
