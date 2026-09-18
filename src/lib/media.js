import { supabase } from "./supabase";

// Public URL for a file in the public-media Storage bucket (hero photo, gallery
// images) — used by both the public HomePage and the admin Website Content editor.
export function publicMediaUrl(path) {
  if (!path) return null;
  return supabase.storage.from("public-media").getPublicUrl(path).data.publicUrl;
}
