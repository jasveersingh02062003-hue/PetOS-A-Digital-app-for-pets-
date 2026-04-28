import { supabase } from "@/integrations/supabase/client";

export type ImageVariants = {
  thumb: string;
  feed: string;
  full: string;
  base_path: string;
};

/**
 * Upload an image via the `image-process` edge function, which produces 3
 * resized JPEG variants (thumb 200px / feed 720px / full 1440px). Falls back
 * to a direct upload if the edge function fails — old behavior is preserved.
 */
export async function uploadImageWithVariants(
  file: File,
  bucket: "posts" | "pet-avatars" | "user-avatars" | "stories" | "marketplace" = "posts",
): Promise<ImageVariants | { thumb: string; feed: string; full: string; base_path: null }> {
  const form = new FormData();
  form.append("file", file);
  form.append("bucket", bucket);

  const { data, error } = await supabase.functions.invoke("image-process", { body: form });
  if (!error && data?.ok) {
    return {
      thumb: data.thumb,
      feed: data.feed,
      full: data.full,
      base_path: data.base_path,
    };
  }

  // Fallback — direct upload of the original. Slower for viewers but never blocks the user.
  console.warn("image-process failed, falling back to direct upload", error);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${user.id}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: "31536000",
  });
  if (upErr) throw upErr;
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
  return { thumb: publicUrl, feed: publicUrl, full: publicUrl, base_path: null };
}
