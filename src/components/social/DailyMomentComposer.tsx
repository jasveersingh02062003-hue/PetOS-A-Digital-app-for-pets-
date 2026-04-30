import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { usePets } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePlus, Loader2, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useLinkMoment } from "@/hooks/useDailyPrompt";

export const ComposerForDailyMoment = ({
  promptId,
  promptText,
  onDone,
}: {
  promptId: string;
  promptText: string;
  onDone: () => void;
}) => {
  const { user } = useAuth();
  const { data: pets } = usePets();
  const qc = useQueryClient();
  const link = useLinkMoment();

  const [caption, setCaption] = useState("");
  const [petId, setPetId] = useState<string>("none");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return toast.error("Image must be under 8 MB");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error("Please sign in");
    if (!file) return toast.error("Add a photo for your moment");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("posts")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("posts").getPublicUrl(path);

      const { data: post, error } = await supabase
        .from("posts")
        .insert({
          author_id: user.id,
          pet_id: petId === "none" ? null : petId,
          caption: caption.trim() || `Daily Moment: ${promptText}`,
          image_url: publicUrl,
        })
        .select()
        .single();
      if (error) throw error;

      await link.mutateAsync({ promptId, postId: post.id });
      qc.invalidateQueries({ queryKey: ["feed"] });
      onDone();
    } catch (err: any) {
      toast.error(err.message || "Could not post");
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="rounded-xl bg-primary/10 border border-primary/30 px-3 py-2 flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-sm font-medium">{promptText}</p>
      </div>

      {preview ? (
        <div className="relative rounded-xl overflow-hidden bg-muted">
          <img src={preview} alt="" className="w-full max-h-72 object-cover" loading="lazy" decoding="async" />
          <button
            type="button"
            onClick={() => { setFile(null); setPreview(null); }}
            className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/90 grid place-items-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full h-40 rounded-xl border-2 border-dashed border-hairline grid place-items-center text-muted-foreground gap-2"
        >
          <ImagePlus className="h-6 w-6" />
          <span className="text-sm">Tap to add photo</span>
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />

      <Textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Optional caption…"
        className="rounded-xl border-hairline min-h-[60px] resize-none"
        maxLength={300}
      />

      {pets && pets.length > 0 && (
        <Select value={petId} onValueChange={setPetId}>
          <SelectTrigger className="h-9 rounded-xl border-hairline text-sm">
            <SelectValue placeholder="Tag a pet" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No pet tag</SelectItem>
            {pets.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <Button type="submit" disabled={uploading} size="lg" className="w-full rounded-xl">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post moment"}
      </Button>
    </form>
  );
};
