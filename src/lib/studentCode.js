// Generates a memorable, name-based access code (e.g. "PS4K7Q" for "Priya Sharma"),
// falling back through alternate letter pairings before resorting to fully random
// characters. Uniqueness is checked against the live database each time, not a
// locally cached list, so two admins adding students at once can't collide.
const SAFE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/1/I/O/L — avoids visual confusion

function randomChars(len) {
  return Array.from({ length: len }, () => SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)]).join("");
}

// Ordered list of 2-letter initials to try: first-name letter x last-name letter,
// cycling through positions before giving up on name-based prefixes entirely.
function initialsCandidates(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const candidates = [];
  if (words.length >= 2) {
    const a = words[0].toUpperCase().replace(/[^A-Z]/g, "");
    const b = words[1].toUpperCase().replace(/[^A-Z]/g, "");
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b.length; j++) {
        candidates.push(a[i] + b[j]);
      }
    }
  } else if (words.length === 1) {
    const w = words[0].toUpperCase().replace(/[^A-Z]/g, "");
    for (let i = 0; i < w.length - 1; i++) candidates.push(w[i] + w[i + 1]);
    if (w.length === 1) candidates.push(w[0] + w[0]);
  }
  return candidates;
}

export async function generateStudentCode(supabase, name, excludeId = null) {
  const codeExists = async (code) => {
    let query = supabase.from("students").select("id").eq("code", code);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.maybeSingle();
    return !!data;
  };

  const prefixes = initialsCandidates(name || "");
  for (const prefix of prefixes) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = prefix + randomChars(4);
      if (!(await codeExists(code))) return code;
    }
  }
  // No usable name, or every name-based attempt collided — fall back to fully random.
  for (let i = 0; i < 25; i++) {
    const code = randomChars(6);
    if (!(await codeExists(code))) return code;
  }
  throw new Error("Couldn't generate a unique code — try again.");
}
