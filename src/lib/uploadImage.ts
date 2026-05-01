import { supabase } from "@/integrations/supabase/client";

export type ImageVariants = {
  thumb: string;
  feed: string;
  full: string;
  base_path: string;
};

/**
 * Client-side downscale before upload. Cuts a 12 MB phone photo to ~400 KB
 * by capping the longest edge at MAX_EDGE px and re-encoding as JPEG q=0.85.
 * Pure canvas — no extra dependency. Bypassed for tiny files (<400 KB) and
 * when the source isn't a raster image (e.g. SVG, GIF).
 */
const MAX_EDGE = 1600;
const MIN_BYTES_TO_COMPRESS = 400 * 1024;

async function downscaleIfLarge(file: File): Promise<File> {
  if (typeof window === "undefined") return file;
  if (file.size < MIN_BYTES_TO_COMPRESS) return file;
  if (!/^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return file;
    const { width, height } = bitmap;
    const longest = Math.max(width, height);
    if (longest <= MAX_EDGE) { bitmap.close?.(); return file; }
    const scale = MAX_EDGE / longest;
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close?.(); return file; }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", 0.85)
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

/**
 * Upload an image via the `image-process` edge function, which produces 3
 * resized JPEG variants (thumb 200px / feed 720px / full 1440px). Falls back
 * to a direct upload if the edge function fails — old behavior is preserved.
 */
export async function uploadImageWithVariants(
  file: File,
  bucket: "posts" | "pet-avatars" | "user-avatars" | "stories" | "marketplace" = "posts",
): Promise<ImageVariants | { thumb: string; feed: string; full: string; base_path: null }> {
  file = await downscaleIfLarge(file);
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
