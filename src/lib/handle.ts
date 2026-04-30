import { supabase } from "@/integrations/supabase/client";

/**
 * Slugify a name/email into a valid @handle candidate.
 * Rules: lowercase, [a-z0-9_.], 3–24 chars, must start with a letter.
 */
export function slugifyHandle(input: string): string {
  let s = (input || "").toLowerCase().trim();
  // strip email domain
  s = s.split("@")[0];
  // replace spaces & invalid chars with underscore
  s = s.replace(/[^a-z0-9_.]+/g, "_");
  // collapse repeats
  s = s.replace(/_+/g, "_").replace(/\.+/g, ".");
  s = s.replace(/^[._]+/, "");
  // ensure starts with letter
  if (s && !/^[a-z]/.test(s)) s = "u" + s;
  s = s.slice(0, 24);
  return s;
}

const HANDLE_RE = /^[a-z][a-z0-9_.]{2,23}$/;

export function validateHandle(h: string): string | null {
  if (!h) return "Pick a handle";
  if (h.length < 3) return "At least 3 characters";
  if (h.length > 24) return "Max 24 characters";
  if (!HANDLE_RE.test(h)) return "Letters, numbers, _ and . only — start with a letter";
  return null;
}

export async function isHandleAvailable(handle: string, currentUserId?: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("handle", handle)
    .limit(1)
    .maybeSingle();
  if (error) {
    // RLS may hide other users' rows — treat as available since DB unique index is the source of truth
    return true;
  }
  if (!data) return true;
  return data.id === currentUserId;
}
