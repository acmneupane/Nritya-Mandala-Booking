import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Field, RichTextEditor, FileInput } from "./ui";
import { publicMediaUrl } from "../lib/media";
import { LOGO_DATA_URI } from "../lib/logo";
import MessagesInbox from "./MessagesInbox";

const SITE_CONTENT_KEYS = ["hero_tagline", "hero_photo_path", "about_blurb", "show_classes", "show_pricing", "show_levels", "classes_capacity_note"];

// Hero photo/tagline, about blurb, video link, and public-visibility toggles for
// the public homepage — stored as key/value rows in site_content, same shape as
// email_templates so more fields can be added later without a migration.
function HeroAboutEditor() {
  const [values, setValues] = useState({});
  const [heroFile, setHeroFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("site_content").select("key, value").in("key", SITE_CONTENT_KEYS);
    setValues(Object.fromEntries((data || []).map((r) => [r.key, r.value])));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setField = (key, value) => setValues((v) => ({ ...v, [key]: value }));

  const removeHeroPhoto = () => {
    setHeroFile(null);
    setField("hero_photo_path", "");
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      let heroPath = values.hero_photo_path || "";
      if (heroFile) {
        const ext = heroFile.name.split(".").pop() || "jpg";
        heroPath = `hero-${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("public-media").upload(heroPath, heroFile);
        if (uploadErr) throw new Error("Couldn't upload the hero photo — please try again.");
      }
      const rows = SITE_CONTENT_KEYS.map((key) => ({
        key, value: key === "hero_photo_path" ? heroPath : (values[key] || ""), updated_at: new Date().toISOString(),
      }));
      const { error: saveErr } = await supabase.from("site_content").upsert(rows, { onConflict: "key" });
      if (saveErr) throw new Error("Couldn't save — please try again.");
      setValues((v) => ({ ...v, hero_photo_path: heroPath }));
      setHeroFile(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>;

  const heroPreview = heroFile ? URL.createObjectURL(heroFile) : publicMediaUrl(values.hero_photo_path);

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>Homepage content</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        Hero photo, tagline, and about text. The class schedule, pricing, and levels come from the rest of the app automatically, but are hidden from the public page by default — turn them on below only once you're ready for cold visitors to see them.
      </p>

      <Field label="Hero photo">
        {heroPreview && <img src={heroPreview} alt="" style={{ width: "100%", maxWidth: 320, borderRadius: 8, marginBottom: 8, display: "block" }} />}
        <div className="flex items-center gap-3 flex-wrap">
          <div style={{ flex: 1, minWidth: 220 }}><FileInput file={heroFile} onChange={setHeroFile} accept="image/*" buttonLabel="Choose photo" /></div>
          {heroPreview && <button onClick={removeHeroPhoto} style={{ fontSize: 12, color: T.terracotta, fontWeight: 600 }}>Remove photo</button>}
        </div>
        {!heroPreview && <p style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>No photo set — the hero section will show a plain maroon background instead.</p>}
      </Field>
      <Field label="Tagline"><input style={inputStyle} value={values.hero_tagline || ""} onChange={(e) => setField("hero_tagline", e.target.value)} placeholder="Where every step tells a story." /></Field>
      <div className="mb-3">
        <RichTextEditor
          label="About us"
          value={values.about_blurb || ""}
          onChange={(html) => setField("about_blurb", html)}
          placeholder="A few paragraphs about the studio…"
        />
      </div>

      <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 14, paddingTop: 14, marginBottom: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.maroonDark, marginBottom: 8, letterSpacing: 0.3 }}>PUBLIC VISIBILITY</div>
        <label className="flex items-center gap-2 mb-2" style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>
          <input type="checkbox" checked={values.show_classes === "true"} onChange={(e) => setField("show_classes", e.target.checked ? "true" : "false")} />
          Show class schedule
        </label>
        {values.show_classes === "true" && (
          <div style={{ marginLeft: 22, marginBottom: 8 }}>
            <Field label="Small note under the class schedule (optional)">
              <textarea
                style={{ ...inputStyle, minHeight: 50 }}
                value={values.classes_capacity_note || ""}
                onChange={(e) => setField("classes_capacity_note", e.target.value)}
                placeholder="e.g. More classes can be added on group request…"
              />
            </Field>
          </div>
        )}
        <label className="flex items-center gap-2 mb-2" style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>
          <input type="checkbox" checked={values.show_pricing === "true"} onChange={(e) => setField("show_pricing", e.target.checked ? "true" : "false")} />
          Show packages &amp; pricing
        </label>
        <label className="flex items-center gap-2 mb-3" style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>
          <input type="checkbox" checked={values.show_levels === "true"} onChange={(e) => setField("show_levels", e.target.checked ? "true" : "false")} />
          Show levels
        </label>
      </div>

      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 10 }}>{error}</p>}
      {saved && <p style={{ color: T.sage, fontSize: 13, marginBottom: 10, fontWeight: 600 }}>Saved.</p>}
      <Btn variant="success" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save homepage content"}</Btn>
    </div>
  );
}

// Ordered photo gallery for the public homepage's carousel, stored in
// site_gallery_images with images in the public-media bucket.
function GalleryEditor() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("site_gallery_images").select("*").order("sort_order");
    setImages(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addPhoto = async (file) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `gallery-${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("public-media").upload(path, file);
      if (uploadErr) throw new Error("Couldn't upload that photo — please try again.");
      const nextOrder = images.length ? Math.max(...images.map((g) => g.sort_order)) + 1 : 0;
      await supabase.from("site_gallery_images").insert({ path, sort_order: nextOrder });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const updateCaption = async (id, caption) => {
    setImages((imgs) => imgs.map((g) => (g.id === id ? { ...g, caption } : g)));
    await supabase.from("site_gallery_images").update({ caption }).eq("id", id);
  };

  const move = async (index, dir) => {
    const other = index + dir;
    if (other < 0 || other >= images.length) return;
    const a = images[index], b = images[other];
    await Promise.all([
      supabase.from("site_gallery_images").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("site_gallery_images").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    load();
  };

  const remove = async (img) => {
    await supabase.from("site_gallery_images").delete().eq("id", img.id);
    await supabase.storage.from("public-media").remove([img.path]);
    load();
  };

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>Photo gallery</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        Shown on the public homepage as a scrollable carousel, in this order — add as many as you like. Use the arrows to reorder, or remove a photo entirely.
      </p>

      {loading ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>
      ) : (
        <div className="grid gap-2 mb-4">
          {images.length === 0 && <p style={{ fontSize: 13, color: T.inkSoft }}>No photos yet.</p>}
          {images.map((g, i) => (
            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${T.line}`, borderRadius: 8, padding: 8 }}>
              <img src={publicMediaUrl(g.path)} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={g.caption || ""}
                placeholder="Caption (optional)"
                onChange={(e) => updateCaption(g.id, e.target.value)}
              />
              <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
                <button onClick={() => move(i, -1)} disabled={i === 0} style={{ fontSize: 14, color: i === 0 ? `${T.inkSoft}66` : T.maroon, padding: "4px 6px" }}>↑</button>
                <button onClick={() => move(i, 1)} disabled={i === images.length - 1} style={{ fontSize: 14, color: i === images.length - 1 ? `${T.inkSoft}66` : T.maroon, padding: "4px 6px" }}>↓</button>
                <button onClick={() => remove(g)} style={{ fontSize: 12, color: T.terracotta, padding: "4px 6px" }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 10 }}>{error}</p>}
      <label style={{ display: "inline-block" }}>
        <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { addPhoto(e.target.files?.[0]); e.target.value = ""; }} disabled={uploading} />
        <span style={{ display: "inline-block", fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 6, background: T.maroon, color: "#fff", cursor: uploading ? "default" : "pointer", opacity: uploading ? 0.6 : 1 }}>
          {uploading ? "Uploading…" : "+ Add photo"}
        </span>
      </label>
    </div>
  );
}

// Ordered video list for the public homepage's "Watch us dance" carousel —
// links only (YouTube/TikTok/Facebook), stored in site_videos. Mirrors
// GalleryEditor's add/reorder/delete shape but takes a link instead of a file.
function VideosEditor() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("site_videos").select("*").order("sort_order");
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => { setUrl(""); setCaption(""); setError(""); };
  const startAdd = () => { resetForm(); setAdding(true); setEditingId(null); };
  const startEdit = (r) => { setUrl(r.url); setCaption(r.caption || ""); setEditingId(r.id); setAdding(false); setError(""); };

  const save = async () => {
    if (!url.trim()) { setError("A video link is required."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = { url: url.trim(), caption: caption.trim() || null };
      if (editingId) {
        await supabase.from("site_videos").update(payload).eq("id", editingId);
      } else {
        const nextOrder = rows.length ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0;
        await supabase.from("site_videos").insert({ ...payload, sort_order: nextOrder });
      }
      setAdding(false);
      setEditingId(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const move = async (index, dir) => {
    const other = index + dir;
    if (other < 0 || other >= rows.length) return;
    const a = rows[index], b = rows[other];
    await Promise.all([
      supabase.from("site_videos").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("site_videos").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    load();
  };

  const remove = async (id) => {
    await supabase.from("site_videos").delete().eq("id", id);
    load();
  };

  const form = (
    <div style={{ border: `1px solid ${T.gold}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
      <Field label="Video link (YouTube, TikTok, or Facebook)"><input style={inputStyle} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=… or a TikTok/Facebook video link" /></Field>
      <Field label="Caption (optional)"><input style={inputStyle} value={caption} onChange={(e) => setCaption(e.target.value)} /></Field>
      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <div className="flex justify-end gap-2 mt-1">
        <Btn variant="ghost" size="sm" onClick={() => { setAdding(false); setEditingId(null); }}>Cancel</Btn>
        <Btn size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
      </div>
    </div>
  );

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>Videos</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        Shown on the public homepage as a scrollable carousel, in this order — add as many as you like. Accepts YouTube, TikTok, or a public Facebook video/reel link.
      </p>

      {loading ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>
      ) : (
        <div className="grid gap-2 mb-4">
          {rows.length === 0 && !adding && <p style={{ fontSize: 13, color: T.inkSoft }}>No videos added yet.</p>}
          {rows.map((r, i) => (
            editingId === r.id ? <div key={r.id}>{form}</div> : (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${T.line}`, borderRadius: 8, padding: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.url}</div>
                  {r.caption && <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{r.caption}</div>}
                </div>
                <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
                  <button onClick={() => move(i, -1)} disabled={i === 0} style={{ fontSize: 14, color: i === 0 ? `${T.inkSoft}66` : T.maroon, padding: "4px 6px" }}>↑</button>
                  <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} style={{ fontSize: 14, color: i === rows.length - 1 ? `${T.inkSoft}66` : T.maroon, padding: "4px 6px" }}>↓</button>
                  <button onClick={() => startEdit(r)} style={{ fontSize: 12, color: T.maroon, padding: "4px 6px" }}>Edit</button>
                  <button onClick={() => remove(r.id)} style={{ fontSize: 12, color: T.terracotta, padding: "4px 6px" }}>Delete</button>
                </div>
              </div>
            )
          ))}
          {adding && form}
        </div>
      )}

      {!adding && editingId === null && <Btn size="sm" variant="ghost" onClick={startAdd}>+ Add video</Btn>}
    </div>
  );
}

// Instructor/teacher bios shown on the public homepage — name, role, bio, and an
// optional photo per instructor, in admin-controlled order.
function InstructorsEditor() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [bio, setBio] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [existingPhotoPath, setExistingPhotoPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("site_instructors").select("*").order("sort_order");
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => { setName(""); setRole(""); setBio(""); setPhotoFile(null); setExistingPhotoPath(""); setError(""); };
  const startAdd = () => { resetForm(); setAdding(true); setEditingId(null); };
  const startEdit = (r) => { setName(r.name); setRole(r.role || ""); setBio(r.bio || ""); setPhotoFile(null); setExistingPhotoPath(r.photo_path || ""); setEditingId(r.id); setAdding(false); setError(""); };

  const save = async () => {
    if (!name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError("");
    try {
      let photoPath = existingPhotoPath;
      if (photoFile) {
        const ext = photoFile.name.split(".").pop() || "jpg";
        photoPath = `instructor-${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("public-media").upload(photoPath, photoFile);
        if (uploadErr) throw new Error("Couldn't upload that photo — please try again.");
      }
      const payload = { name: name.trim(), role: role.trim() || null, bio: bio.trim() || null, photo_path: photoPath || null };
      if (editingId) {
        await supabase.from("site_instructors").update(payload).eq("id", editingId);
      } else {
        const nextOrder = rows.length ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0;
        await supabase.from("site_instructors").insert({ ...payload, sort_order: nextOrder });
      }
      setAdding(false);
      setEditingId(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const move = async (index, dir) => {
    const other = index + dir;
    if (other < 0 || other >= rows.length) return;
    const a = rows[index], b = rows[other];
    await Promise.all([
      supabase.from("site_instructors").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("site_instructors").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    load();
  };

  const remove = async (r) => {
    await supabase.from("site_instructors").delete().eq("id", r.id);
    if (r.photo_path) await supabase.storage.from("public-media").remove([r.photo_path]);
    load();
  };

  const photoPreview = photoFile ? URL.createObjectURL(photoFile) : publicMediaUrl(existingPhotoPath);

  const form = (
    <div style={{ border: `1px solid ${T.gold}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
      <Field label="Name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Role (optional)"><input style={inputStyle} value={role} onChange={(e) => setRole(e.target.value)} placeholder="Founder & Lead Instructor" /></Field>
      <Field label="Bio (optional)"><textarea style={{ ...inputStyle, minHeight: 80 }} value={bio} onChange={(e) => setBio(e.target.value)} /></Field>
      <Field label="Photo (optional)">
        {photoPreview && <img src={photoPreview} alt="" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", marginBottom: 8, display: "block" }} />}
        <FileInput file={photoFile} onChange={setPhotoFile} accept="image/*" buttonLabel="Choose photo" />
      </Field>
      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <div className="flex justify-end gap-2 mt-1">
        <Btn variant="ghost" size="sm" onClick={() => { setAdding(false); setEditingId(null); }}>Cancel</Btn>
        <Btn size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
      </div>
    </div>
  );

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>Instructors</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>Team bios shown on the public homepage, in this order.</p>

      {loading ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>
      ) : (
        <div className="grid gap-2 mb-4">
          {rows.length === 0 && !adding && <p style={{ fontSize: 13, color: T.inkSoft }}>No instructors added yet.</p>}
          {rows.map((r, i) => (
            editingId === r.id ? <div key={r.id}>{form}</div> : (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${T.line}`, borderRadius: 8, padding: 8 }}>
                {r.photo_path ? (
                  <img src={publicMediaUrl(r.photo_path)} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: T.paper, flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{r.name}</div>
                  {r.role && <div style={{ fontSize: 11, color: T.inkSoft }}>{r.role}</div>}
                </div>
                <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
                  <button onClick={() => move(i, -1)} disabled={i === 0} style={{ fontSize: 14, color: i === 0 ? `${T.inkSoft}66` : T.maroon, padding: "4px 6px" }}>↑</button>
                  <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} style={{ fontSize: 14, color: i === rows.length - 1 ? `${T.inkSoft}66` : T.maroon, padding: "4px 6px" }}>↓</button>
                  <button onClick={() => startEdit(r)} style={{ fontSize: 12, color: T.maroon, padding: "4px 6px" }}>Edit</button>
                  <button onClick={() => remove(r)} style={{ fontSize: 12, color: T.terracotta, padding: "4px 6px" }}>Delete</button>
                </div>
              </div>
            )
          ))}
          {adding && form}
        </div>
      )}

      {!adding && editingId === null && <Btn size="sm" variant="ghost" onClick={startAdd}>+ Add instructor</Btn>}
    </div>
  );
}

function StarPicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} style={{ fontSize: 20, color: n <= value ? T.gold : T.line, lineHeight: 1 }}>★</button>
      ))}
    </div>
  );
}

// Testimonials shown on the public homepage — author, star rating, title, content.
function TestimonialsEditor() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [authorName, setAuthorName] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("site_testimonials").select("*").order("sort_order");
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => { setAuthorName(""); setRating(5); setTitle(""); setContent(""); setError(""); };
  const startAdd = () => { resetForm(); setAdding(true); setEditingId(null); };
  const startEdit = (r) => { setAuthorName(r.author_name || ""); setRating(r.rating); setTitle(r.title || ""); setContent(r.content); setEditingId(r.id); setAdding(false); setError(""); };

  const save = async () => {
    if (!content.trim()) { setError("Content is required."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = { author_name: authorName.trim() || null, rating, title: title.trim() || null, content: content.trim() };
      if (editingId) {
        await supabase.from("site_testimonials").update(payload).eq("id", editingId);
      } else {
        const nextOrder = rows.length ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0;
        await supabase.from("site_testimonials").insert({ ...payload, sort_order: nextOrder });
      }
      setAdding(false);
      setEditingId(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const move = async (index, dir) => {
    const other = index + dir;
    if (other < 0 || other >= rows.length) return;
    const a = rows[index], b = rows[other];
    await Promise.all([
      supabase.from("site_testimonials").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("site_testimonials").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    load();
  };

  const remove = async (id) => {
    await supabase.from("site_testimonials").delete().eq("id", id);
    load();
  };

  const form = (
    <div style={{ border: `1px solid ${T.gold}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
      <Field label="Author name (optional)"><input style={inputStyle} value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="e.g. Priya, parent of a student" /></Field>
      <Field label="Rating"><StarPicker value={rating} onChange={setRating} /></Field>
      <Field label="Title (optional)"><input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Amazing studio!" /></Field>
      <Field label="Content"><textarea style={{ ...inputStyle, minHeight: 80 }} value={content} onChange={(e) => setContent(e.target.value)} /></Field>
      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <div className="flex justify-end gap-2 mt-1">
        <Btn variant="ghost" size="sm" onClick={() => { setAdding(false); setEditingId(null); }}>Cancel</Btn>
        <Btn size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
      </div>
    </div>
  );

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>Testimonials</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>Shown on the public homepage, in this order.</p>

      {loading ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>
      ) : (
        <div className="grid gap-2 mb-4">
          {rows.length === 0 && !adding && <p style={{ fontSize: 13, color: T.inkSoft }}>No testimonials added yet.</p>}
          {rows.map((r, i) => (
            editingId === r.id ? <div key={r.id}>{form}</div> : (
              <div key={r.id} style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 10 }}>
                <div className="flex items-center justify-between gap-2">
                  <div style={{ fontSize: 13, color: T.gold }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
                  <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
                    <button onClick={() => move(i, -1)} disabled={i === 0} style={{ fontSize: 14, color: i === 0 ? `${T.inkSoft}66` : T.maroon, padding: "4px 6px" }}>↑</button>
                    <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} style={{ fontSize: 14, color: i === rows.length - 1 ? `${T.inkSoft}66` : T.maroon, padding: "4px 6px" }}>↓</button>
                    <button onClick={() => startEdit(r)} style={{ fontSize: 12, color: T.maroon, padding: "4px 6px" }}>Edit</button>
                    <button onClick={() => remove(r.id)} style={{ fontSize: 12, color: T.terracotta, padding: "4px 6px" }}>Delete</button>
                  </div>
                </div>
                {r.title && <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginTop: 4 }}>{r.title}</div>}
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{r.content}</div>
                {r.author_name && <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 4, fontStyle: "italic" }}>— {r.author_name}</div>}
              </div>
            )
          ))}
          {adding && form}
        </div>
      )}

      {!adding && editingId === null && <Btn size="sm" variant="ghost" onClick={startAdd}>+ Add testimonial</Btn>}
    </div>
  );
}

// FAQ shown on the public homepage as an accordion.
function FaqEditor() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("site_faqs").select("*").order("sort_order");
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => { setQuestion(""); setAnswer(""); setError(""); };
  const startAdd = () => { resetForm(); setAdding(true); setEditingId(null); };
  const startEdit = (r) => { setQuestion(r.question); setAnswer(r.answer); setEditingId(r.id); setAdding(false); setError(""); };

  const save = async () => {
    if (!question.trim() || !answer.trim()) { setError("Both question and answer are required."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = { question: question.trim(), answer: answer.trim() };
      if (editingId) {
        await supabase.from("site_faqs").update(payload).eq("id", editingId);
      } else {
        const nextOrder = rows.length ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0;
        await supabase.from("site_faqs").insert({ ...payload, sort_order: nextOrder });
      }
      setAdding(false);
      setEditingId(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const move = async (index, dir) => {
    const other = index + dir;
    if (other < 0 || other >= rows.length) return;
    const a = rows[index], b = rows[other];
    await Promise.all([
      supabase.from("site_faqs").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("site_faqs").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    load();
  };

  const remove = async (id) => {
    await supabase.from("site_faqs").delete().eq("id", id);
    load();
  };

  const form = (
    <div style={{ border: `1px solid ${T.gold}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
      <Field label="Question"><input style={inputStyle} value={question} onChange={(e) => setQuestion(e.target.value)} /></Field>
      <Field label="Answer"><textarea style={{ ...inputStyle, minHeight: 80 }} value={answer} onChange={(e) => setAnswer(e.target.value)} /></Field>
      {error && <p style={{ color: T.terracotta, fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <div className="flex justify-end gap-2 mt-1">
        <Btn variant="ghost" size="sm" onClick={() => { setAdding(false); setEditingId(null); }}>Cancel</Btn>
        <Btn size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
      </div>
    </div>
  );

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>FAQ</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>Shown on the public homepage as an expandable list, in this order.</p>

      {loading ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>
      ) : (
        <div className="grid gap-2 mb-4">
          {rows.length === 0 && !adding && <p style={{ fontSize: 13, color: T.inkSoft }}>No FAQ entries yet.</p>}
          {rows.map((r, i) => (
            editingId === r.id ? <div key={r.id}>{form}</div> : (
              <div key={r.id} style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 10 }}>
                <div className="flex items-center justify-between gap-2">
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{r.question}</div>
                  <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
                    <button onClick={() => move(i, -1)} disabled={i === 0} style={{ fontSize: 14, color: i === 0 ? `${T.inkSoft}66` : T.maroon, padding: "4px 6px" }}>↑</button>
                    <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} style={{ fontSize: 14, color: i === rows.length - 1 ? `${T.inkSoft}66` : T.maroon, padding: "4px 6px" }}>↓</button>
                    <button onClick={() => startEdit(r)} style={{ fontSize: 12, color: T.maroon, padding: "4px 6px" }}>Edit</button>
                    <button onClick={() => remove(r.id)} style={{ fontSize: 12, color: T.terracotta, padding: "4px 6px" }}>Delete</button>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>{r.answer}</div>
              </div>
            )
          ))}
          {adding && form}
        </div>
      )}

      {!adding && editingId === null && <Btn size="sm" variant="ghost" onClick={startAdd}>+ Add question</Btn>}
    </div>
  );
}

// Controls whether the public site's root shows the real homepage or a simple
// coming-soon placeholder (App.jsx's PublicHomeGate reads the same site_live
// key). Defaults to "off" so a fresh site never accidentally shows an
// unfinished homepage — the studio flips it once the content below is ready.
function GoLiveToggle() {
  const [live, setLive] = useState(null); // null = loading
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("site_content").select("value").eq("key", "site_live").maybeSingle();
    setLive(data?.value === "true");
  };

  useEffect(() => { load(); }, []);

  const setLiveStatus = async (nextLive) => {
    setSaving(true);
    await supabase.from("site_content").upsert({ key: "site_live", value: nextLive ? "true" : "false", updated_at: new Date().toISOString() }, { onConflict: "key" });
    setLive(nextLive);
    setSaving(false);
  };

  if (live === null) return null;

  return (
    <div
      className="flex items-center justify-between flex-wrap gap-3 mb-4"
      style={{ background: live ? `${T.sage}18` : `${T.gold}18`, border: `1px solid ${live ? T.sage : T.gold}55`, borderRadius: 8, padding: "12px 16px" }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: live ? T.sage : T.maroonDark }}>
          {live ? "🟢 Your site is live" : "🟡 Showing “Coming soon” to visitors"}
        </div>
        <p style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
          {live
            ? "The homepage below is what visitors see at your main website address."
            : "Visitors to your main website address see a simple coming-soon page until you go live."}
        </p>
      </div>
      {live ? (
        <Btn variant="ghost" size="sm" onClick={() => setLiveStatus(false)} disabled={saving}>{saving ? "…" : "Go offline"}</Btn>
      ) : (
        <Btn variant="success" size="sm" onClick={() => setLiveStatus(true)} disabled={saving}>{saving ? "…" : "Go live"}</Btn>
      )}
    </div>
  );
}

// Studio logo — a single upload here (site_content's logo_path key, resolved
// by useLogoUrl in src/lib/logo.js) replaces the built-in default mark
// everywhere it appears: this admin app's login screen and sidebar, and every
// public-facing page (homepage, including its footer, parent portal, and the
// enrol/transfer/renew forms).
function LogoEditor() {
  const [logoPath, setLogoPath] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("site_content").select("value").eq("key", "logo_path").maybeSingle();
    setLogoPath(data?.value || "");
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!logoFile) return;
    setSaving(true);
    setError("");
    try {
      const ext = logoFile.name.split(".").pop() || "png";
      const path = `logo-${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("public-media").upload(path, logoFile);
      if (uploadErr) throw new Error("Couldn't upload the logo — please try again.");
      const { error: saveErr } = await supabase.from("site_content").upsert({ key: "logo_path", value: path, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (saveErr) throw new Error("Couldn't save — please try again.");
      setLogoPath(path);
      setLogoFile(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  const preview = logoFile ? URL.createObjectURL(logoFile) : (logoPath ? publicMediaUrl(logoPath) : LOGO_DATA_URI);

  return (
    <div className="flex items-center gap-4 flex-wrap mb-4" style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: "12px 16px" }}>
      <img src={preview} alt="" style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", border: `1px solid ${T.line}`, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.maroonDark, marginBottom: 2 }}>Logo</div>
        <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 8 }}>Used everywhere the studio mark appears — this changes it on every page at once.</p>
        <FileInput file={logoFile} onChange={setLogoFile} accept="image/*" buttonLabel="Choose logo" />
        {error && <p style={{ color: T.terracotta, fontSize: 13, marginTop: 6 }}>{error}</p>}
        {saved && <p style={{ color: T.sage, fontSize: 13, marginTop: 6, fontWeight: 600 }}>Saved.</p>}
      </div>
      {logoFile && (
        <Btn size="sm" variant="success" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save logo"}</Btn>
      )}
    </div>
  );
}

// A single long-form legal/policy document, stored as one site_content row.
// Used for Privacy Policy, Terms & Conditions, and House Rules — each its own
// tab, each editable independently rather than saved together.
function LegalDocEditor({ contentKey, title, description, placeholder, pageHref }) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("site_content").select("value").eq("key", contentKey).maybeSingle();
    setValue(data?.value || "");
    setLoading(false);
  };

  // contentKey is fixed for the lifetime of a mounted instance — each tab
  // renders its own separately-keyed <LegalDocEditor>, so switching tabs
  // remounts rather than reusing this instance with a new contentKey.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await supabase.from("site_content").upsert({ key: contentKey, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>;

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>{title}</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        {description} Shown at <code style={{ background: T.paper, padding: "1px 5px", borderRadius: 4 }}>{pageHref}</code>.
      </p>

      <div className="mb-3">
        <RichTextEditor value={value} onChange={setValue} placeholder={placeholder} minHeight={320} />
      </div>

      {saved && <p style={{ color: T.sage, fontSize: 13, marginBottom: 10, fontWeight: 600 }}>Saved.</p>}
      <Btn variant="success" onClick={save} disabled={saving}>{saving ? "Saving…" : `Save ${title}`}</Btn>
    </div>
  );
}

const SECTIONS = [
  { id: "homepage", label: "Homepage" },
  { id: "gallery", label: "Gallery" },
  { id: "videos", label: "Videos" },
  { id: "instructors", label: "Instructors" },
  { id: "testimonials", label: "Testimonials" },
  { id: "faq", label: "FAQ" },
  { id: "messages", label: "Messages" },
  { id: "privacy", label: "Privacy Policy" },
  { id: "terms", label: "Terms & Conditions" },
  { id: "house-rules", label: "House Rules" },
];

export default function WebsiteContentView() {
  const [section, setSection] = useState("homepage");

  return (
    <div style={{ maxWidth: 620 }}>
      <LogoEditor />
      <GoLiveToggle />
      <div className="flex gap-1 mb-4 flex-wrap" style={{ background: T.paper, borderRadius: 8, padding: 3, display: "inline-flex" }}>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, background: section === s.id ? "#fff" : "transparent", color: section === s.id ? T.maroonDark : T.inkSoft, fontWeight: section === s.id ? 600 : 400 }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "homepage" && <HeroAboutEditor />}
      {section === "gallery" && <GalleryEditor />}
      {section === "videos" && <VideosEditor />}
      {section === "instructors" && <InstructorsEditor />}
      {section === "testimonials" && <TestimonialsEditor />}
      {section === "faq" && <FaqEditor />}
      {section === "messages" && <MessagesInbox />}
      {section === "privacy" && (
        <LegalDocEditor
          contentKey="privacy_policy_html"
          title="Privacy Policy"
          description="Linked from the enrolment, renewal and transfer forms (each requires agreeing to it before submitting), plus the homepage and parent page footers."
          placeholder="What we collect, why, and who we share it with…"
          pageHref="/privacy"
        />
      )}
      {section === "terms" && (
        <LegalDocEditor
          contentKey="terms_conditions_html"
          title="Terms & Conditions"
          description="Linked from the enrolment, renewal and transfer forms (each requires agreeing to it before submitting), plus the homepage and parent page footers."
          placeholder="Enrolment, payment, renewal and transfer terms…"
          pageHref="/terms"
        />
      )}
      {section === "house-rules" && (
        <LegalDocEditor
          contentKey="house_rules_html"
          title="House Rules"
          description="Shown inline on the enrolment form's Important Information panel, and linked from the renewal and transfer forms and from Terms & Conditions."
          placeholder="Location, parking, attendance, illness policy, what to wear…"
          pageHref="/house-rules"
        />
      )}
    </div>
  );
}
