import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { ConfirmModal } from "./ui";
import { formatSydneyDateTime } from "../lib/dates";

// Dashboard: unread messages from the website's "Get in touch" form (and the
// parent page's message-the-studio form). Each is also emailed to the studio
// when it arrives. "Mark as read" hides it here and from the weekly digest;
// "Delete" removes it for good. Needs the Website permission (RLS on
// contact_messages), so the Dashboard only renders this for those users.
export default function UnreadMessages() {
  const [messages, setMessages] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("contact_messages").select("id, name, email, phone, message, created_at").eq("read", false).order("created_at", { ascending: false })
      .then(({ data }) => setMessages(data || []));
  }, []);

  const remove = (id) => setMessages((ms) => ms.filter((m) => m.id !== id));

  const markRead = async (m) => {
    setBusyId(m.id);
    setError("");
    const { error: err } = await supabase.from("contact_messages").update({ read: true }).eq("id", m.id);
    setBusyId(null);
    if (err) setError("Couldn't mark that message as read — please try again.");
    else remove(m.id);
  };

  const deleteMessage = async (m) => {
    setConfirmDelete(null);
    setBusyId(m.id);
    setError("");
    const { error: err } = await supabase.from("contact_messages").delete().eq("id", m.id);
    setBusyId(null);
    if (err) setError("Couldn't delete that message — please try again.");
    else remove(m.id);
  };

  if (!messages || messages.length === 0) return null;

  const action = { fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: "#fff", cursor: "pointer" };

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 17, color: T.maroonDark, marginBottom: 4 }}>✉️ Unread messages ({messages.length})</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10 }}>From the website's "Get in touch" form — each was also emailed to the studio. Mark as read once it's been dealt with.</p>
      {error && <p style={{ fontSize: 13, color: T.terracotta, fontWeight: 600, marginBottom: 8 }}>{error}</p>}
      <div className="grid gap-2">
        {messages.map((m) => (
          <div key={m.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderLeft: `4px solid ${T.gold}`, borderRadius: 8, padding: "10px 14px" }}>
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <span style={{ fontFamily: "Fraunces, serif", fontSize: 15, color: T.maroonDark }}>{m.name || "Someone"}</span>
              <span style={{ fontSize: 11, color: T.inkSoft }}>{formatSydneyDateTime(m.created_at)}</span>
            </div>
            {(m.email || m.phone) && (
              <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                {m.email && <a href={`mailto:${m.email}`} style={{ color: T.maroon }}>{m.email}</a>}
                {m.email && m.phone && " · "}
                {m.phone && <a href={`tel:${m.phone}`} style={{ color: T.maroon }}>{m.phone}</a>}
              </div>
            )}
            <div style={{ fontSize: 13, color: T.ink, marginTop: 6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.message}</div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => markRead(m)} disabled={busyId === m.id} style={{ ...action, color: T.sage, border: `1px solid ${T.sage}88` }}>✓ Mark as read</button>
              <button onClick={() => setConfirmDelete(m)} disabled={busyId === m.id} style={{ ...action, color: T.terracotta, border: `1px solid ${T.terracotta}55` }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      {confirmDelete && (
        <ConfirmModal
          title="Delete this message?"
          message={<>The message from <strong>{confirmDelete.name || "this person"}</strong> will be deleted for good. The copy that was emailed to the studio isn't affected.</>}
          confirmLabel="Delete"
          onConfirm={() => deleteMessage(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
