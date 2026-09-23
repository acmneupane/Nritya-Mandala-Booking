import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { ConfirmModal } from "./ui";
import { ALL_PERMISSIONS } from "../lib/permissions";

// Admin-only: this tab itself is gated by canAccessTab("team") = "ADMIN_ONLY"
// in Dashboard.jsx, and the underlying admin_users/user_permissions tables are
// separately locked down by RLS to admin-write/self-read — so even a stray
// render of this component couldn't actually change anyone's access without
// the viewer genuinely being an admin.
export default function TeamView() {
  const [users, setUsers] = useState([]);
  const [permsByUser, setPermsByUser] = useState({});
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState(null);
  const [confirmSelfDemote, setConfirmSelfDemote] = useState(null); // user row pending confirmation
  const [saving, setSaving] = useState(null); // `${userId}:${field}` currently in flight

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: { user } }, uRes, pRes] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("admin_users").select("*").order("email"),
      supabase.from("user_permissions").select("*"),
    ]);
    setMyId(user?.id || null);
    setUsers(uRes.data || []);
    const byUser = {};
    (pRes.data || []).forEach((p) => (byUser[p.user_id] ||= new Set()).add(p.permission));
    setPermsByUser(byUser);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setAdmin = async (u, isAdmin) => {
    if (u.id === myId && !isAdmin) { setConfirmSelfDemote(u); return; }
    setSaving(`${u.id}:admin`);
    await supabase.from("admin_users").update({ is_admin: isAdmin }).eq("id", u.id);
    await load();
    setSaving(null);
  };

  const togglePermission = async (userId, permission, checked) => {
    setSaving(`${userId}:${permission}`);
    if (checked) {
      await supabase.from("user_permissions").insert({ user_id: userId, permission });
    } else {
      await supabase.from("user_permissions").delete().eq("user_id", userId).eq("permission", permission);
    }
    await load();
    setSaving(null);
  };

  if (loading) return <p style={{ color: T.inkSoft }}>Loading…</p>;

  return (
    <div>
      <p style={{ fontSize: 13, color: T.inkSoft, marginBottom: 18, lineHeight: 1.5 }}>
        Admin always has full access, regardless of the permissions below. Everyone else sees only the tabs their checked permissions unlock — a change here takes effect the next time that person reloads the app or logs in, not immediately in a session they already have open.
      </p>
      <div className="grid gap-3">
        {users.map((u) => {
          const perms = permsByUser[u.id] || new Set();
          return (
            <div key={u.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 16 }}>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div style={{ fontSize: 14, fontWeight: 600, color: T.maroonDark }}>
                  {u.email}{u.id === myId && <span style={{ fontSize: 11, color: T.inkSoft, fontWeight: 500 }}> (you)</span>}
                </div>
                <label className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 600, color: T.gold }}>
                  <input
                    type="checkbox"
                    checked={u.is_admin}
                    disabled={saving === `${u.id}:admin`}
                    onChange={(e) => setAdmin(u, e.target.checked)}
                  />
                  Admin (full access)
                </label>
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", opacity: u.is_admin ? 0.55 : 1 }}>
                {ALL_PERMISSIONS.map((p) => (
                  <label key={p.key} className="flex items-center gap-2" style={{ fontSize: 13, color: T.ink }}>
                    <input
                      type="checkbox"
                      checked={perms.has(p.key)}
                      disabled={saving === `${u.id}:${p.key}`}
                      onChange={(e) => togglePermission(u.id, p.key, e.target.checked)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
              {u.is_admin && <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 8 }}>Admin already grants everything — permissions above are optional extra bookkeeping, not required.</p>}
            </div>
          );
        })}
      </div>

      {confirmSelfDemote && (
        <ConfirmModal
          title="Remove your own Admin access?"
          message={`You're about to remove Admin from your own account (${confirmSelfDemote.email}). If you don't have another permission that covers what you need, you could lock yourself out of parts of the app until another admin restores it. Continue?`}
          confirmLabel="Remove my Admin access"
          onCancel={() => setConfirmSelfDemote(null)}
          onConfirm={async () => {
            const u = confirmSelfDemote;
            setConfirmSelfDemote(null);
            setSaving(`${u.id}:admin`);
            await supabase.from("admin_users").update({ is_admin: false }).eq("id", u.id);
            await load();
            setSaving(null);
          }}
        />
      )}
    </div>
  );
}
