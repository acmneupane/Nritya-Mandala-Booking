import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { T, inputStyle } from "../lib/theme";
import { useLogoUrl } from "../lib/logo";
import { classesLabel } from "../lib/format";
import { formatTimeRange, compareClassSchedule } from "../lib/scheduling";
import { localDateStr, formatShortDate } from "../lib/dates";
import { classStartsInFuture } from "../lib/classAvailability";
import { publicMediaUrl } from "../lib/media";
import { Field } from "./ui";
import TurnstileWidget from "./TurnstileWidget";
import NoticeMessage from "./NoticeMessage";

// Shared "premium card" treatment — soft shadow at rest, a slightly deeper one
// plus a small lift on hover. Colors stay inline (matching T.*, the app's theme
// object) since Tailwind's generated classes can't reference it directly; these
// utility classes only add what inline styles can't (hover/transition states).
const CARD = "bg-white rounded-2xl shadow-[0_4px_16px_-4px_rgba(36,27,21,0.10)] hover:shadow-[0_14px_32px_-8px_rgba(36,27,21,0.16)] hover:-translate-y-0.5 transition-all duration-300";

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

// Shared caption treatment for gallery photos and videos — an italic serif
// line (matching the heading font) reads as a formal photo/video credit line
// rather than plain UI copy.
const CAPTION_STYLE = { fontFamily: "Fraunces, serif", fontStyle: "italic", fontSize: 13.5, color: T.maroonDark, letterSpacing: 0.2, textAlign: "center", marginTop: 10, opacity: 0.85 };

function SectionHeading({ children, center = true }) {
  return (
    <h2
      className={`font-serif text-2xl sm:text-3xl md:text-4xl ${center ? "text-center" : ""}`}
      style={{ fontFamily: "Fraunces, serif", color: T.maroonDark, marginBottom: 28, fontWeight: 600 }}
    >
      {children}
    </h2>
  );
}

// A horizontally-swipeable row with arrow controls instead of a visible
// scrollbar — used for every card-row section on the homepage (classes,
// gallery, videos) so they all behave the same way. Touch/trackpad swipe and
// scroll-snap still work underneath; the arrows just call scrollBy on the same
// track, and hide themselves once there's nothing further to scroll to.
function Carousel({ children }) {
  const trackRef = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);
  // Whether the row's content is actually wider than the visible track — only
  // center the row when it isn't (e.g. 1-2 cards on a wide screen). Centering a
  // row that overflows breaks scrolling on mobile: justify-content: center on a
  // scrollable flex container starts it already scrolled into the middle of the
  // content, clipping the first card instead of showing it in full.
  const [overflowing, setOverflowing] = useState(false);

  const updateEdges = () => {
    const el = trackRef.current;
    if (!el) return;
    setOverflowing(el.scrollWidth > el.clientWidth + 4);
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => { updateEdges(); });
  useEffect(() => {
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, []);

  const scrollByPage = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  const arrowStyle = { position: "absolute", top: "50%", transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", background: "#fff", boxShadow: "0 4px 14px -2px rgba(36,27,21,0.25)", alignItems: "center", justifyContent: "center", color: T.maroon, fontSize: 20, zIndex: 2, border: "none" };

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={updateEdges}
        className={`no-scrollbar flex items-start gap-4 ${overflowing ? "" : "justify-center"}`}
        style={{ overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", paddingBottom: 4 }}
      >
        {children}
      </div>
      {!atStart && (
        <button onClick={() => scrollByPage(-1)} aria-label="Previous" className="hidden sm:flex hover:scale-105 transition-transform" style={{ ...arrowStyle, left: -18 }}>‹</button>
      )}
      {!atEnd && (
        <button onClick={() => scrollByPage(1)} aria-label="Next" className="hidden sm:flex hover:scale-105 transition-transform" style={{ ...arrowStyle, right: -18 }}>›</button>
      )}
    </div>
  );
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
      <div className={CARD} style={{ padding: "28px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 15, color: T.sage, fontWeight: 700 }}>Thanks — we've received your message and will be in touch soon.</p>
      </div>
    );
  }

  return (
    <div className={CARD} style={{ padding: "28px 24px" }}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Name"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Phone (optional)"><input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      </div>
      <Field label="Email (optional)"><input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Message"><textarea style={{ ...inputStyle, minHeight: 100 }} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask us anything — classes, pricing, trial spots…" /></Field>
      {error && <p style={{ color: T.terracotta, fontSize: 13, marginTop: 4 }}>{error}</p>}
      <TurnstileWidget onVerify={setTurnstileToken} />
      <button
        onClick={submit}
        disabled={submitting || !turnstileToken}
        className="hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300"
        style={{ background: T.maroon, color: "#fff", fontWeight: 700, padding: "12px 26px", borderRadius: 999, border: "none", fontSize: 14, opacity: submitting || !turnstileToken ? 0.6 : 1, cursor: submitting || !turnstileToken ? "default" : "pointer" }}
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
// they're ready. Shown at the domain root once the studio flips "Go live" on the
// admin Website page (see PublicHomeGate in App.jsx) — always reachable directly
// at /new in the meantime for previewing/building it before that switch.
export default function HomePage() {
  const logoUrl = useLogoUrl();
  const [content, setContent] = useState({});
  const [gallery, setGallery] = useState([]);
  const [classes, setClasses] = useState([]);
  const [levels, setLevels] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [notices, setNotices] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studioInfo, setStudioInfo] = useState({
    studio_address: "72 Central Avenue, Oran Park, NSW 2570",
    social_facebook_url: "https://www.facebook.com/profile.php?id=100095383322004",
    social_tiktok_url: "https://www.tiktok.com/@nritya.mandala",
  });

  const [classCounts, setClassCounts] = useState({}); // { [classId]: effective enrolled count }

  useEffect(() => {
    const today = localDateStr(new Date());
    Promise.all([
      supabase.from("site_content").select("key, value"),
      supabase.from("site_gallery_images").select("*").order("sort_order"),
      supabase.from("classes").select("*"),
      supabase.rpc("get_effective_class_counts"),
      supabase.from("levels").select("*").order("order_num"),
      supabase.from("package_tiers").select("*").eq("active", true).order("sort_order"),
      supabase.from("studio_notices").select("*").eq("show_on_public", true).lte("start_date", today).gte("end_date", today).order("start_date"),
      supabase.from("site_instructors").select("*").order("sort_order"),
      supabase.from("site_testimonials").select("*").order("sort_order"),
      supabase.from("site_faqs").select("*").order("sort_order"),
      supabase.from("site_videos").select("*").order("sort_order"),
      supabase.from("admin_settings").select("studio_address, social_facebook_url, social_tiktok_url").eq("id", 1).maybeSingle(),
    ]).then(([contentRes, galleryRes, classesRes, countsRes, levelsRes, tiersRes, noticesRes, instructorsRes, testimonialsRes, faqsRes, videosRes, studioInfoRes]) => {
      setContent(Object.fromEntries((contentRes.data || []).map((r) => [r.key, r.value])));
      setGallery(galleryRes.data || []);
      // Show anything not yet ended — including a class that hasn't started yet,
      // labeled with its start date below rather than hidden until it begins.
      setClasses((classesRes.data || []).filter((c) => !c.end_date || c.end_date >= today).slice().sort(compareClassSchedule));
      setClassCounts(Object.fromEntries((countsRes.data || []).map((row) => [row.class_id, Number(row.effective_count)])));
      setLevels(levelsRes.data || []);
      setTiers(tiersRes.data || []);
      setNotices(noticesRes.data || []);
      setInstructors(instructorsRes.data || []);
      setTestimonials(testimonialsRes.data || []);
      setFaqs(faqsRes.data || []);
      setVideos(videosRes.data || []);
      if (studioInfoRes.data) setStudioInfo((prev) => ({ ...prev, ...studioInfoRes.data }));
      setLoading(false);
    });
  }, []);

  const today = localDateStr(new Date());
  const levelById = Object.fromEntries(levels.map((l) => [l.id, l]));
  const heroPhotoUrl = publicMediaUrl(content.hero_photo_path);

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.inkSoft, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: T.ivory, fontFamily: "Inter, sans-serif" }}>
      {/* Hero */}
      <section
        className="min-h-[70vh] flex flex-col items-center justify-center px-5 py-24 text-center relative overflow-hidden"
        style={{
          background: heroPhotoUrl
            ? `linear-gradient(180deg, rgba(110,29,23,0.55), rgba(110,29,23,0.9)), url(${heroPhotoUrl})`
            : `linear-gradient(160deg, ${T.maroon}, ${T.maroonDark})`,
          backgroundSize: "cover", backgroundPosition: "center",
        }}
      >
        <div className="relative z-10 flex flex-col items-center max-w-3xl mx-auto">
          <div className="w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center mb-8 shadow-2xl overflow-hidden border-4" style={{ background: T.ivory, borderColor: "rgba(255,255,255,0.2)" }}>
            <img src={logoUrl} alt="" className="w-full h-full object-cover" />
          </div>
          <p style={{ color: T.goldLight, fontSize: 13, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 16 }}>Nritya Mandala</p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl" style={{ fontFamily: "Fraunces, serif", color: "#fff", fontWeight: 600, lineHeight: 1.15, marginBottom: 40, textShadow: "0 2px 12px rgba(0,0,0,0.25)" }}>
            {content.hero_tagline || "Where every step tells a story."}
          </h1>
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <a
              href="/enroll"
              className="hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
              style={{ background: T.gold, color: T.maroonDark, fontWeight: 700, padding: "16px 40px", borderRadius: 999, textDecoration: "none", fontSize: 15 }}
            >
              Enrol now
            </a>
            <a
              href="/parent"
              className="hover:bg-white transition-all duration-300"
              style={{ background: "transparent", color: "#fff", fontWeight: 600, padding: "15px 40px", borderRadius: 999, textDecoration: "none", fontSize: 15, border: "2px solid rgba(255,255,255,0.7)" }}
            >
              Look up my booking
            </a>
          </div>
        </div>
      </section>

      {/* Content */}
      <div style={{ background: T.ivory, borderRadius: "32px 32px 0 0", marginTop: -24, position: "relative", zIndex: 1 }}>
        <div className="max-w-[1160px] mx-auto px-5 md:px-10 pt-12 pb-8">
          {notices.map((n) => (
            <div key={n.id} className="max-w-[820px] mx-auto rounded-2xl" style={{ background: T.gold, padding: "16px 22px", marginBottom: 24, boxShadow: `0 8px 24px -6px ${T.gold}88` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.maroonDark, letterSpacing: 0.6, marginBottom: 4, textTransform: "uppercase" }}>📣 Announcement</div>
              <NoticeMessage message={n.message} style={{ fontSize: 16, fontWeight: 500, color: T.maroonDark, lineHeight: 1.5 }} />
            </div>
          ))}
        </div>

        {content.about_blurb && (
          <section className="px-5 md:px-10 py-16">
            <div className="max-w-[760px] mx-auto text-center">
              <SectionHeading>About us</SectionHeading>
              {/* Written with the rich-text editor in Website settings, so this is
                  trusted admin-authored HTML, not user input. Older content saved
                  before that editor existed is plain text with no tags — rendered
                  the old way (respecting bare line breaks) so it doesn't collapse
                  into one line the first time this loads after the change. */}
              {/<[a-z][\s\S]*>/i.test(content.about_blurb) ? (
                <div className="rich-text-content" style={{ fontSize: 16, color: T.ink, lineHeight: 1.8, opacity: 0.85, textAlign: "left" }} dangerouslySetInnerHTML={{ __html: content.about_blurb }} />
              ) : (
                <p style={{ fontSize: 16, color: T.ink, lineHeight: 1.8, whiteSpace: "pre-wrap", opacity: 0.85 }}>{content.about_blurb}</p>
              )}
            </div>
          </section>
        )}

        {content.show_classes === "true" && (
          <section className="px-5 md:px-10 py-16">
            <div className="max-w-[1160px] mx-auto">
              <SectionHeading>Class schedule</SectionHeading>
              {classes.length === 0 ? (
                <p style={{ fontSize: 14, color: T.inkSoft, textAlign: "center" }}>Schedule coming soon — get in touch to find out what's running.</p>
              ) : (
                <Carousel>
                  {classes.map((c) => {
                    const spotsLeft = c.capacity - (classCounts[c.id] || 0);
                    const isFull = spotsLeft <= 0;
                    const isAlmostFull = !isFull && spotsLeft < 5;
                    return (
                      <div key={c.id} className={`${CARD} w-[85vw] sm:w-[300px] flex-none`} style={{ padding: "18px 20px", scrollSnapAlign: "start" }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{c.label}</div>
                        <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>
                          {c.day} · {formatTimeRange(c.time, c.end_time)}{levelById[c.level_id] ? ` · ${levelById[c.level_id].name}` : ""}
                        </div>
                        {classStartsInFuture(c, today) && (
                          <div style={{ fontSize: 12, color: T.gold, fontWeight: 700, marginTop: 6 }}>Starts {formatShortDate(c.start_date)}</div>
                        )}
                        {isFull ? (
                          <div style={{ fontSize: 11, fontWeight: 700, color: T.maroon, background: `${T.gold}22`, borderRadius: 999, padding: "3px 10px", marginTop: 8, display: "inline-block" }}>
                            Popular — currently full, ask about the waitlist
                          </div>
                        ) : isAlmostFull && (
                          <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, background: `${T.gold}18`, borderRadius: 999, padding: "3px 10px", marginTop: 8, display: "inline-block" }}>
                            Filling up fast — {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Carousel>
              )}
              {content.classes_capacity_note && (
                <p style={{ fontSize: 12, color: T.inkSoft, textAlign: "center", marginTop: 20, fontStyle: "italic" }}>{content.classes_capacity_note}</p>
              )}
            </div>
          </section>
        )}

        {content.show_pricing === "true" && tiers.length > 0 && (
          <section className="px-5 md:px-10 py-16" style={{ background: "#fff", borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` }}>
            <div className="max-w-[820px] mx-auto">
              <SectionHeading>Packages &amp; pricing</SectionHeading>
              <div className="grid gap-3">
                {tiers.map((t) => (
                  <div key={t.id} className={CARD} style={{ padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{t.name}</div>
                      <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 2 }}>{classesLabel(t.classes_count)}</div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: T.maroonDark, fontFamily: "Fraunces, serif" }}>${Number(t.price).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {content.show_levels === "true" && levels.length > 0 && (
          <section className="px-5 md:px-10 py-16">
            <div className="max-w-[1160px] mx-auto">
              <SectionHeading>Levels</SectionHeading>
              <div className="flex flex-wrap justify-center gap-4">
                {levels.map((l) => (
                  <div key={l.id} className={`${CARD} w-full sm:w-[300px] flex-none`} style={{ padding: "18px 20px" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{l.name}</div>
                    {l.description && <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4, lineHeight: 1.5 }}>{l.description}</div>}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {instructors.length > 0 && (
          <section className="px-5 md:px-10 py-16" style={{ background: "#fff", borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` }}>
            <div className="max-w-[1160px] mx-auto">
              <SectionHeading>Meet the team</SectionHeading>
              <div className="flex flex-wrap justify-center gap-8">
                {instructors.map((i) => (
                  <div key={i.id} className="text-center w-[45%] sm:w-40 flex-none">
                    {i.photo_path ? (
                      <img src={publicMediaUrl(i.photo_path)} alt="" className="w-24 h-24 md:w-28 md:h-28 rounded-full object-cover mx-auto mb-4 shadow-lg" />
                    ) : (
                      <div className="w-24 h-24 md:w-28 md:h-28 rounded-full mx-auto mb-4" style={{ background: T.paper }} />
                    )}
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{i.name}</div>
                    {i.role && <div style={{ fontSize: 12, color: T.gold, fontWeight: 700, marginTop: 3 }}>{i.role}</div>}
                    {i.bio && <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 8, lineHeight: 1.6 }}>{i.bio}</div>}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {gallery.length > 0 && (
          <section className="px-5 md:px-10 py-16">
            <div className="max-w-[1160px] mx-auto">
              <SectionHeading>Gallery</SectionHeading>
              <Carousel>
                {gallery.map((g) => (
                  <div key={g.id} className="flex-none group" style={{ width: 260, scrollSnapAlign: "start" }}>
                    <div className="rounded-2xl overflow-hidden shadow-[0_4px_16px_-4px_rgba(36,27,21,0.14)]" style={{ aspectRatio: "1", background: T.paper }}>
                      <img src={publicMediaUrl(g.path)} alt={g.caption || ""} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                    {g.caption && <div style={CAPTION_STYLE}>{g.caption}</div>}
                  </div>
                ))}
              </Carousel>
            </div>
          </section>
        )}

        {testimonials.length > 0 && (
          <section className="px-5 md:px-10 py-16" style={{ background: "#fff", borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` }}>
            <div className="max-w-[1160px] mx-auto">
              <SectionHeading>What families say</SectionHeading>
              <div className="flex flex-wrap justify-center gap-6">
                {testimonials.map((t) => (
                  <div key={t.id} className={`${CARD} w-full sm:w-[340px] flex-none`} style={{ padding: "28px 24px" }}>
                    <div className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 36, color: T.goldLight, lineHeight: 0.6, marginBottom: 14 }}>&ldquo;</div>
                    <div style={{ fontSize: 15, color: T.gold, marginBottom: 10 }}>{"★".repeat(t.rating)}{"☆".repeat(5 - t.rating)}</div>
                    {t.title && <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 6 }}>{t.title}</div>}
                    <p style={{ fontSize: 14, color: T.ink, lineHeight: 1.7, opacity: 0.85, fontStyle: "italic" }}>{t.content}</p>
                    {t.author_name && <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 14, fontWeight: 600 }}>— {t.author_name}</div>}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {videos.length > 0 && (
          <section className="px-5 md:px-10 py-16">
            <div className="max-w-[1160px] mx-auto">
              <SectionHeading>Watch us dance</SectionHeading>
              <Carousel>
                {videos.map((v) => {
                  const embed = videoEmbed(v.url);
                  if (!embed) return null;
                  return (
                    <div key={v.id} className="flex-none" style={{ scrollSnapAlign: "start" }}>
                      {embed.type === "tiktok" ? (
                        // TikTok's embed is a full mini-page (video + caption + like/comment/
                        // share buttons), not just the video frame — a 9:16 crop clipped it,
                        // so the only way to see the rest was to scroll inside the iframe.
                        // Sized to TikTok's own embed proportions (~325x730) instead, tall
                        // enough that nothing inside needs to scroll.
                        <iframe
                          src={embed.src}
                          title="Nritya Mandala video"
                          className="shadow-[0_10px_30px_-5px_rgba(36,27,21,0.2)]"
                          style={{ border: "none", width: 325, maxWidth: "85vw", height: 730, borderRadius: 24 }}
                          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      ) : embed.type === "facebook" ? (
                        <iframe
                          src={embed.src}
                          title="Nritya Mandala video"
                          className="shadow-[0_10px_30px_-5px_rgba(36,27,21,0.2)]"
                          style={{ border: "none", width: 260, maxWidth: "80vw", aspectRatio: "9 / 16", borderRadius: 24 }}
                          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      ) : (
                        <div className="shadow-[0_10px_30px_-5px_rgba(36,27,21,0.2)]" style={{ width: 360, maxWidth: "80vw", position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 20, overflow: "hidden" }}>
                          <iframe
                            src={embed.src}
                            title="Nritya Mandala video"
                            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      )}
                      {v.caption && <div style={CAPTION_STYLE}>{v.caption}</div>}
                    </div>
                  );
                })}
              </Carousel>
            </div>
          </section>
        )}

        {faqs.length > 0 && (
          <section className="px-5 md:px-10 py-16" style={{ background: "#fff", borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` }}>
            <div className="max-w-[760px] mx-auto">
              <SectionHeading>Frequently asked questions</SectionHeading>
              <div className="grid gap-3">
                {faqs.map((f) => (
                  <details key={f.id} className={`group list-none [&::-webkit-details-marker]:hidden overflow-hidden ${CARD}`}>
                    <summary className="cursor-pointer list-none flex items-center justify-between gap-4" style={{ padding: "18px 22px", fontSize: 15, fontWeight: 700, color: T.ink }}>
                      <span>{f.question}</span>
                      <svg className="shrink-0 transition-transform duration-300 group-open:rotate-180" style={{ width: 18, height: 18, color: T.maroon }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <p style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.7, padding: "0 22px 20px", borderTop: `1px solid ${T.line}`, paddingTop: 14 }}>{f.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="px-5 md:px-10 py-16">
          <div className="max-w-[820px] mx-auto">
            <SectionHeading>Get in touch</SectionHeading>
            <ContactForm />
          </div>
        </section>

        {/* Footer */}
        <footer className="px-5 py-16 text-center" style={{ background: T.ink }}>
          <div className="max-w-[600px] mx-auto flex flex-col items-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 overflow-hidden" style={{ background: "#fff" }}>
              <img src={logoUrl} alt="" className="w-full h-full object-cover" />
            </div>
            <h2 className="font-serif" style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: T.goldLight, fontWeight: 600, marginBottom: 20 }}>Find us</h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", marginBottom: 10 }}>📍 {studioInfo.studio_address}</p>
            <a href={`https://maps.google.com/?q=${encodeURIComponent(studioInfo.studio_address)}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: T.goldLight, fontWeight: 600, textDecoration: "underline", letterSpacing: 0.5 }}>GET DIRECTIONS</a>
            <div className="w-full max-w-[320px] flex items-center justify-center gap-2 flex-wrap" style={{ marginTop: 32, paddingTop: 28, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
              <a href={studioInfo.social_facebook_url} target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition-opacity" style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>Facebook</a>
              <span style={{ color: "rgba(255,255,255,0.3)" }}>|</span>
              <a href={studioInfo.social_tiktok_url} target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition-opacity" style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>TikTok</a>
            </div>
            <div className="flex items-center justify-center gap-2" style={{ marginTop: 16 }}>
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition-opacity" style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Privacy Policy</a>
              <span style={{ color: "rgba(255,255,255,0.25)" }}>|</span>
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition-opacity" style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Terms &amp; Conditions</a>
            </div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 20 }}>© {new Date().getFullYear()} Nritya Mandala. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
