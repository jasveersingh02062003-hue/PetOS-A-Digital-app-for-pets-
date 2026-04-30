import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BUCKET = "health-media";
const MAX = 4;
const MAX_BYTES = 3 * 1024 * 1024;

/** Downscale a File to ≤1600 px on the long side, JPEG q≈0.85. */
async function downscale(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  return await new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.85));
}

function signedUrlFor(path: string): Promise<string | null> {
  return supabase.storage.from(BUCKET).createSignedUrl(path, 3600).then(({ data }) => data?.signedUrl ?? null);
}

export const PhotoUploadField = ({
  value, onChange, disabled,
}: { value: string[]; onChange: (paths: string[]) => void; disabled?: boolean }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const ensurePreview = async (path: string) => {
    if (previews[path]) return;
    const url = await signedUrlFor(path);
    if (url) setPreviews((p) => ({ ...p, [path]: url }));
  };
  value.forEach(ensurePreview);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    if (value.length + files.length > MAX) return toast.error(`Max ${MAX} photos`);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return toast.error("Please sign in");
    setBusy(true);
    const next = [...value];
    try {
      for (const f of files) {
        if (f.size > MAX_BYTES * 4) { toast.error(`${f.name} is too large`); continue; }
        const blob = await downscale(f);
        if (blob.size > MAX_BYTES) { toast.error(`${f.name} still too large after compression`); continue; }
        const path = `${u.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (error) { toast.error(error.message); continue; }
        next.push(path);
      }
      onChange(next);
    } finally {
      setBusy(false);
    }
  };

  const remove = (path: string) => {
    onChange(value.filter((p) => p !== path));
    supabase.storage.from(BUCKET).remove([path]).catch(() => {});
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((p) => (
          <div key={p} className="relative h-16 w-16 rounded-xl overflow-hidden border border-hairline bg-muted">
            {previews[p]
              ? <img src={previews[p]} alt="" className="h-full w-full object-cover" />
              : <div className="h-full w-full animate-pulse bg-muted" />}
            <button type="button" onClick={() => remove(p)} className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {value.length < MAX && (
          <Button type="button" variant="outline" size="sm" disabled={busy || disabled}
            className="h-16 w-16 rounded-xl border-dashed border-hairline flex flex-col items-center justify-center gap-1"
            onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            <span className="text-[10px]">Photo</span>
          </Button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple capture="environment" hidden onChange={onPick} />
    </div>
  );
};

/** Inline thumbnails (read-only) for use on Timeline / detail views. */
export const PhotoThumbs = ({ paths }: { paths?: string[] | null }) => {
  const [urls, setUrls] = useState<Record<string, string>>({});
  if (!paths?.length) return null;
  paths.forEach((p) => {
    if (!urls[p]) signedUrlFor(p).then((u) => u && setUrls((cur) => ({ ...cur, [p]: u })));
  });
  return (
    <div className="mt-2 flex gap-1.5 flex-wrap">
      {paths.map((p) => (
        <a key={p} href={urls[p] ?? "#"} target="_blank" rel="noreferrer"
          className="h-14 w-14 rounded-lg overflow-hidden border border-hairline bg-muted block">
          {urls[p] ? <img src={urls[p]} alt="" className="h-full w-full object-cover" /> : null}
        </a>
      ))}
    </div>
  );
};
