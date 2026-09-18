import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { Btn, Field } from "./ui";
import { publicMediaUrl } from "../lib/media";

const SITE_CONTENT_KEYS = ["hero_tagline", "hero_photo_path", "about_blurb", "show_classes", "show_pricing", "show_levels"];

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
        <input type="file" accept="image/*" onChange={(e) => setHeroFile(e.target.files?.[0] || null)} style={{ fontSize: 13 }} />
      </Field>
      <Field label="Tagline"><input style={inputStyle} value={values.hero_tagline || ""} onChange={(e) => setField("hero_tagline", e.target.value)} placeholder="Where every step tells a story." /></Field>
      <Field label="About us"><textarea style={{ ...inputStyle, minHeight: 120 }} value={values.about_blurb || ""} onChange={(e) => setField("about_blurb", e.target.value)} placeholder="A few paragraphs about the studio…" /></Field>

      <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 14, paddingTop: 14, marginBottom: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.maroonDark, marginBottom: 8, letterSpacing: 0.3 }}>PUBLIC VISIBILITY</div>
        <label className="flex items-center gap-2 mb-2" style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>
          <input type="checkbox" checked={values.show_classes === "true"} onChange={(e) => setField("show_classes", e.target.checked ? "true" : "false")} />
          Show class schedule
        </label>
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
        <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} style={{ fontSize: 13 }} />
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

// Read-only inbox for submissions from the public homepage's contact form.
// Rows are only ever created server-side (submit_contact_message RPC via
// submit-form, Turnstile-verified) — never directly writable by anon — so this is
// purely a viewer, plus a read/unread toggle.
function MessagesViewer() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("contact_messages").select("*").order("created_at", { ascending: false });
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleRead = async (r) => {
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, read: !x.read } : x)));
    await supabase.from("contact_messages").update({ read: !r.read }).eq("id", r.id);
  };

  const unreadCount = rows.filter((r) => !r.read).length;

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 18 }}>
      <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 16, color: T.maroonDark, marginBottom: 6 }}>Contact form messages</h3>
      <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        {unreadCount > 0 ? `${unreadCount} unread. ` : ""}Every submission is also emailed to the studio inbox automatically — this is just a browsable record.
      </p>
      {loading ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: 13, color: T.inkSoft }}>No messages yet.</p>
      ) : (
        <div className="grid gap-2">
          {rows.map((r) => (
            <div key={r.id} style={{ background: r.read ? "#fff" : `${T.gold}0F`, border: `1px solid ${T.line}`, borderLeft: `3px solid ${r.read ? T.line : T.gold}`, borderRadius: 6, padding: "10px 12px" }}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{r.name}</span>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 11, color: T.inkSoft }}>{new Date(r.created_at).toLocaleString()}</span>
                  <button onClick={() => toggleRead(r)} style={{ fontSize: 11, color: T.maroon, fontWeight: 600 }}>{r.read ? "Mark unread" : "Mark read"}</button>
                </div>
              </div>
              <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>
                {r.email && <>{r.email} · </>}{r.phone || ""}
              </div>
              <div style={{ fontSize: 13, color: T.ink, marginTop: 6, whiteSpace: "pre-wrap" }}>{r.message}</div>
            </div>
          ))}
        </div>
      )}
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
];

export default function WebsiteContentView() {
  const [section, setSection] = useState("homepage");

  return (
    <div style={{ maxWidth: 620 }}>
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
      {section === "messages" && <MessagesViewer />}
    </div>
  );
}
