import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { LOGO_DATA_URI } from "../lib/logo";
import { classesLabel } from "../lib/format";
import { formatTimeRange, compareClassSchedule, isClassActiveOn } from "../lib/scheduling";
import { localDateStr } from "../lib/dates";
import { publicMediaUrl } from "../lib/media";
import { Field } from "./ui";
import TurnstileWidget from "./TurnstileWidget";

// Accepts a YouTube link (watch/youtu.be/embed), a TikTok video link, or a public
// Facebook video/reel link and returns { type, src } for an embeddable iframe, or
// null if it's none of those. Facebook's public video plugin embed
// (facebook.com/plugins/video.php) and TikTok's oEmbed-less /embed/v2/<id> path
// both work for a public video without needing an app ID or API key.
function videoEmbed(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be") || u.hostname.includes("youtube.com")) {
      const id = u.hostname.includes("youtu.be")
        ? u.pathname.slice(1)
        : u.searchParams.get("v") || (u.pathname.startsWith("/embed/") ? u.pathname.split("/")[2] : null);
      return id ? { type: "youtube", src: `https://www.youtube.com/embed/${id}` } : null;
    }
    if (u.hostname.includes("facebook.com") || u.hostname.includes("fb.watch")) {
      return { type: "facebook", src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false` };
    }
    if (u.hostname.includes("tiktok.com")) {
      const m = u.pathname.match(/\/video\/(\d+)/);
      return m ? { type: "tiktok", src: `https://www.tiktok.com/embed/v2/${m[1]}` } : null;
    }
    return null;
  } catch {
    return null;
  }
}

// Simple contact form — submits through the same Turnstile-gated submit-form edge
// function as enrolment/renewal/transfer (formType "contact" -> the
// submit_contact_message RPC, which emails the studio and logs the message for
// the admin's Website > Messages tab). Nothing is inserted directly by the
// browser, so a bot can't bypass Turnstile by calling the table API directly.
function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim() || !message.trim()) { setError("Please fill in your name and a message."); return; }
    setError("");
    setSubmitting(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("submit-form", {
        body: {
          turnstileToken,
          formType: "contact",
          params: { p_name: name.trim(), p_email: email.trim() || null, p_phone: phone.trim() || null, p_message: message.trim() },
        },
      });
      if (fnErr || !data?.ok) throw new Error(data?.error || "Something went wrong sending your message — please try again.");
      setSent(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: "16px 18px", textAlign: "center" }}>
        <p style={{ fontSize: 14, color: T.sage, fontWeight: 600 }}>Thanks — we've received your message and will be in touch soon.</p>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: "16px 18px" }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Phone (optional)"><input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      </div>
      <Field label="Email (optional)"><input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Message"><textarea style={{ ...inputStyle, minHeight: 90 }} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask us anything — classes, pricing, trial spots…" /></Field>
      {error && <p style={{ color: T.terracotta, fontSize: 13, marginTop: 4 }}>{error}</p>}
      <TurnstileWidget onVerify={setTurnstileToken} />
      <button
        onClick={submit}
        disabled={submitting || !turnstileToken}
        style={{ background: T.maroon, color: "#fff", fontWeight: 700, padding: "10px 22px", borderRadius: 999, border: "none", fontSize: 14, opacity: submitting || !turnstileToken ? 0.6 : 1 }}
      >
        {submitting ? "Sending…" : "Send message"}
      </button>
    </div>
  );
}

// The real public homepage — pulls live schedule/pricing/notices/levels straight
// from the same tables the admin app uses, plus admin-editable static content
// (hero photo, tagline, about blurb, gallery, video, instructors, testimonials,
// FAQ) managed from the admin app's Website page. The schedule/pricing/levels
// sections are each gated behind their own show_classes/show_pricing/show_levels
// toggle (default off) — showing exact pricing to a cold visitor before they've
// engaged can talk them out of enrolling, so the studio opts in per-section when
// they're ready. Currently mounted at /new (see App.jsx) rather than the domain
// root, so it can be reviewed and filled in with real content before going live;
// ComingSoonPage stays the default at "/" until that switch is made.
export default function HomePage() {
  const [content, setContent] = useState({});
  const [gallery, setGallery] = useState([]);
  const [classes, setClasses] = useState([]);
  const [levels, setLevels] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [notices, setNotices] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = localDateStr(new Date());
    Promise.all([
      supabase.from("site_content").select("key, value"),
      supabase.from("site_gallery_images").select("*").order("sort_order"),
      supabase.from("classes").select("*"),
      supabase.from("levels").select("*").order("order_num"),
      supabase.from("package_tiers").select("*").eq("active", true).order("sort_order"),
      supabase.from("studio_notices").select("*").lte("start_date", today).gte("end_date", today).order("start_date"),
      supabase.from("site_instructors").select("*").order("sort_order"),
      supabase.from("site_testimonials").select("*").order("sort_order"),
      supabase.from("site_faqs").select("*").order("sort_order"),
    ]).then(([contentRes, galleryRes, classesRes, levelsRes, tiersRes, noticesRes, instructorsRes, testimonialsRes, faqsRes]) => {
      setContent(Object.fromEntries((contentRes.data || []).map((r) => [r.key, r.value])));
      setGallery(galleryRes.data || []);
      setClasses((classesRes.data || []).filter((c) => isClassActiveOn(c, today)).slice().sort(compareClassSchedule));
      setLevels(levelsRes.data || []);
      setTiers(tiersRes.data || []);
      setNotices(noticesRes.data || []);
      setInstructors(instructorsRes.data || []);
      setTestimonials(testimonialsRes.data || []);
      setFaqs(faqsRes.data || []);
      setLoading(false);
    });
  }, []);

  const levelById = Object.fromEntries(levels.map((l) => [l.id, l]));
  const heroPhotoUrl = publicMediaUrl(content.hero_photo_path);
  const embed = videoEmbed(content.video_url);

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: T.maroon, fontFamily: "Inter, sans-serif" }}>
      <div
        style={{
          background: heroPhotoUrl
            ? `linear-gradient(180deg, rgba(110,29,23,0.55), rgba(110,29,23,0.85)), url(${heroPhotoUrl})`
            : T.maroon,
          backgroundSize: "cover", backgroundPosition: "center",
          padding: "56px 20px 48px", textAlign: "center",
        }}
      >
        <img src={LOGO_DATA_URI} alt="" style={{ width: 76, height: 76, borderRadius: "50%", margin: "0 auto 16px", display: "block" }} />
        <p style={{ fontSize: 12, color: T.goldLight, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Nritya Mandala</p>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 30, color: "#fff", marginBottom: 18, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
          {content.hero_tagline || "Where every step tells a story."}
        </h1>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <a href="/enroll" style={{ background: T.gold, color: T.maroonDark, fontWeight: 700, padding: "12px 24px", borderRadius: 999, textDecoration: "none", fontSize: 14 }}>Enrol now</a>
          <a href="/parent" style={{ background: "rgba(255,255,255,0.15)", color: "#fff", fontWeight: 600, padding: "12px 24px", borderRadius: 999, textDecoration: "none", fontSize: 14, border: "1px solid rgba(255,255,255,0.4)" }}>Look up my booking</a>
        </div>
      </div>

      <div style={{ background: T.ivory, borderRadius: "24px 24px 0 0", marginTop: -20, padding: "32px 20px 60px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {notices.map((n) => (
            <div key={n.id} style={{ background: T.gold, borderRadius: 10, padding: "14px 18px", marginBottom: 20, boxShadow: `0 2px 8px ${T.gold}55` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.maroonDark, letterSpacing: 0.6, marginBottom: 4, textTransform: "uppercase" }}>📣 Announcement</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.maroonDark, lineHeight: 1.4 }}>{n.message}</div>
            </div>
          ))}

          {content.about_blurb && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.maroonDark, marginBottom: 10 }}>About us</h2>
              <p style={{ fontSize: 14, color: T.ink, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{content.about_blurb}</p>
            </section>
          )}

          {content.show_classes === "true" && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.maroonDark, marginBottom: 10 }}>Class schedule</h2>
              {classes.length === 0 ? (
                <p style={{ fontSize: 13, color: T.inkSoft }}>Schedule coming soon — get in touch to find out what's running.</p>
              ) : (
                <div className="grid gap-2">
                  {classes.map((c) => (
                    <div key={c.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: "12px 14px" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{c.label}</div>
                      <div style={{ fontSize: 12, color: T.inkSoft }}>
                        {c.day} · {formatTimeRange(c.time, c.end_time)}{levelById[c.level_id] ? ` · ${levelById[c.level_id].name}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {content.show_pricing === "true" && tiers.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.maroonDark, marginBottom: 10 }}>Packages &amp; pricing</h2>
              <div className="grid gap-2">
                {tiers.map((t) => (
                  <div key={t.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: T.inkSoft }}>{classesLabel(t.classes_count)}</div>
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: T.maroonDark, fontFamily: "Fraunces, serif" }}>${Number(t.price).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {content.show_levels === "true" && levels.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.maroonDark, marginBottom: 10 }}>Levels</h2>
              <div className="grid gap-2">
                {levels.map((l) => (
                  <div key={l.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{l.name}</div>
                    {l.description && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{l.description}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {instructors.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.maroonDark, marginBottom: 10 }}>Meet the team</h2>
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
                {instructors.map((i) => (
                  <div key={i.id} style={{ textAlign: "center" }}>
                    {i.photo_path ? (
                      <img src={publicMediaUrl(i.photo_path)} alt="" style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", margin: "0 auto 8px", display: "block" }} />
                    ) : (
                      <div style={{ width: 96, height: 96, borderRadius: "50%", background: T.paper, margin: "0 auto 8px" }} />
                    )}
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{i.name}</div>
                    {i.role && <div style={{ fontSize: 11, color: T.gold, fontWeight: 600, marginTop: 2 }}>{i.role}</div>}
                    {i.bio && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 6, lineHeight: 1.5 }}>{i.bio}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {gallery.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.maroonDark, marginBottom: 10 }}>Gallery</h2>
              <div className="flex gap-3" style={{ overflowX: "auto", scrollSnapType: "x mandatory", paddingBottom: 8, WebkitOverflowScrolling: "touch" }}>
                {gallery.map((g) => (
                  <div key={g.id} style={{ flex: "0 0 auto", width: 220, scrollSnapAlign: "start" }}>
                    <div style={{ borderRadius: 8, overflow: "hidden", aspectRatio: "1", background: T.paper }}>
                      <img src={publicMediaUrl(g.path)} alt={g.caption || ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    </div>
                    {g.caption && <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 4 }}>{g.caption}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {testimonials.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.maroonDark, marginBottom: 10 }}>What families say</h2>
              <div className="grid gap-3">
                {testimonials.map((t) => (
                  <div key={t.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: "14px 16px" }}>
                    <div style={{ fontSize: 14, color: T.gold, marginBottom: 4 }}>{"★".repeat(t.rating)}{"☆".repeat(5 - t.rating)}</div>
                    {t.title && <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 4 }}>{t.title}</div>}
                    <p style={{ fontSize: 13, color: T.ink, lineHeight: 1.6 }}>{t.content}</p>
                    {t.author_name && <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 6, fontStyle: "italic" }}>— {t.author_name}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {embed && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.maroonDark, marginBottom: 10 }}>Watch us dance</h2>
              {embed.type === "facebook" || embed.type === "tiktok" ? (
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <iframe
                    src={embed.src}
                    title="Nritya Mandala video"
                    style={{ border: "none", width: "100%", maxWidth: 350, aspectRatio: "9 / 16", borderRadius: 8 }}
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 8, overflow: "hidden" }}>
                  <iframe
                    src={embed.src}
                    title="Nritya Mandala video"
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
            </section>
          )}

          {faqs.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.maroonDark, marginBottom: 10 }}>Frequently asked questions</h2>
              <div className="grid gap-2">
                {faqs.map((f) => (
                  <details key={f.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: "10px 14px" }}>
                    <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 600, color: T.ink }}>{f.question}</summary>
                    <p style={{ fontSize: 13, color: T.inkSoft, marginTop: 8, lineHeight: 1.6 }}>{f.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.maroonDark, marginBottom: 10 }}>Get in touch</h2>
            <ContactForm />
          </section>

          <section style={{ textAlign: "center", marginTop: 40 }}>
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: T.maroonDark, marginBottom: 10 }}>Find us</h2>
            <p style={{ fontSize: 13, color: T.ink, marginBottom: 4 }}>📍 72 Central Avenue, Oran Park, NSW 2570</p>
            <a href="https://maps.google.com/?q=72+Central+Avenue+Oran+Park+NSW" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: T.maroonDark, fontWeight: 600, textDecoration: "underline" }}>Get directions</a>
            <div className="flex items-center justify-center gap-2 flex-wrap" style={{ marginTop: 18 }}>
              <a href="https://www.facebook.com/profile.php?id=100095383322004" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: T.maroonDark, fontWeight: 600, textDecoration: "underline" }}>Facebook</a>
              <span style={{ color: T.inkSoft }}>·</span>
              <a href="https://g.page/r/Cd0RBuUBpA3jEBM/review" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: T.maroonDark, fontWeight: 600, textDecoration: "underline" }}>Google Reviews</a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
