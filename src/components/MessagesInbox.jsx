import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";
import { ConfirmModal } from "./ui";
import { formatSydneyDateTime } from "../lib/dates";

// Website → Messages: every message from the website's "Get in touch" form (and
// the parent page's message-the-studio form), read and unread. Each one is also
// emailed to the studio when it arrives. Unread ones also show on the Dashboard
// and in the weekly digest until marked as read. Needs the Website permission
// (RLS on contact_messages).
export default function MessagesInbox() {
  const [messages, setMessages] = useState(null);
  const [filter, setFilter] = useState("all"); // "all" | "unread"
  const [busyId, setBusyId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("contact_messages").select("id, name, email, phone, message, created_at, read").order("created_at", { ascending: false })
      .then(({ data }) => setMessages(data || []));
  }, []);

  const setRead = async (m, read) => {
    setBusyId(m.id);
    setError("");
    const { error: err } = await supabase.from("contact_messages").update({ read }).eq("id", m.id);
    setBusyId(null);
    if (err) setError("Couldn't update that message — please try again.");
    else setMessages((ms) => ms.map((x) => (x.id === m.id ? { ...x, read } : x)));
  };

  const deleteMessage = async (m) => {
    setConfirmDelete(null);
    setBusyId(m.id);
    setError("");
    const { error: err } = await supabase.from("contact_messages").delete().eq("id", m.id);
    setBusyId(null);
    if (err) setError("Couldn't delete that message — please try again.");
    else setMessages((ms) => ms.filter((x) => x.id !== m.id));
  };

  const card = { background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18 };
  const action = { fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: "#fff", cursor: "pointer" };

  if (messages === null) return <div style={card}><p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p></div>;

  const unreadCount = messages.filter((m) => !m.read).length;
  const shown = filter === "unread" ? messages.filter((m) => !m.read) : messages;

  return (
    <div style={card}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>Messages</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 12, lineHeight: 1.5 }}>
        Messages from the website's "Get in touch" form. Each one is also emailed to the studio when it arrives. Unread messages also show on the Dashboard and in the weekly digest until they're marked as read.
      </p>

      <div className="flex gap-1 mb-3" style={{ background: T.paper, borderRadius: 8, padding: 3, display: "inline-flex" }}>
        {[
          { id: "all", label: `All (${messages.length})` },
          { id: "unread", label: `Unread (${unreadCount})` },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{ fontSize: 13, padding: "5px 12px", borderRadius: 6, background: filter === f.id ? "#fff" : "transparent", color: filter === f.id ? T.maroonDark : T.inkSoft, fontWeight: filter === f.id ? 600 : 400 }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p style={{ fontSize: 13, color: T.terracotta, fontWeight: 600, marginBottom: 8 }}>{error}</p>}

      {shown.length === 0 ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>{filter === "unread" ? "No unread messages." : "No messages yet."}</p>
      ) : (
        <div className="grid gap-2">
          {shown.map((m) => (
            <div key={m.id} style={{ background: m.read ? "#fff" : `${T.gold}0F`, border: `1px solid ${T.line}`, borderLeft: `3px solid ${m.read ? T.line : T.gold}`, borderRadius: 6, padding: "10px 12px" }}>
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>
                  {m.name || "Someone"}
                  {!m.read && <span style={{ fontSize: 10, fontWeight: 700, color: T.gold, marginLeft: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>Unread</span>}
                </span>
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
                {m.read ? (
                  <button onClick={() => setRead(m, false)} disabled={busyId === m.id} style={{ ...action, color: T.inkSoft, border: `1px solid ${T.line}` }}>Mark as unread</button>
                ) : (
                  <button onClick={() => setRead(m, true)} disabled={busyId === m.id} style={{ ...action, color: T.sage, border: `1px solid ${T.sage}88` }}>✓ Mark as read</button>
                )}
                <button onClick={() => setConfirmDelete(m)} disabled={busyId === m.id} style={{ ...action, color: T.terracotta, border: `1px solid ${T.terracotta}55` }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

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
