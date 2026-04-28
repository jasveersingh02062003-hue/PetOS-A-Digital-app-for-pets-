import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { usePets } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, ImagePlus, X, Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { CollabPicker, type CollabUser } from "@/components/social/CollabPicker";
import { useInviteCollaborators } from "@/hooks/useCollabs";
import { HealthTagPicker, type HealthTag } from "@/components/health/HealthTagPicker";

export const ComposerButton = ({ variant = "icon" }: { variant?: "icon" | "fab" | "inline" }) => {
  const [open, setOpen] = useState(false);
  const trigger = variant === "fab" ? (
    <button className="fixed bottom-24 right-5 z-30 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform">
      <Plus className="h-6 w-6" />
    </button>
  ) : variant === "inline" ? (
    <Button variant="outline" className="w-full h-12 rounded-xl border-hairline justify-start text-muted-foreground gap-2">
      <ImagePlus className="h-4 w-4" /> Share a moment
    </Button>
  ) : (
    <Button variant="ghost" size="icon" className="rounded-full h-11 w-11 border border-hairline">
      <Camera className="h-5 w-5" strokeWidth={1.6} />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">New post</DialogTitle></DialogHeader>
        <Composer onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
};

const Composer = ({ onDone }: { onDone: () => void }) => {
  const { user } = useAuth();
  const { data: pets } = usePets();
  const qc = useQueryClient();
  const invite = useInviteCollaborators();
  const [caption, setCaption] = useState("");
  const [petId, setPetId] = useState<string>("none");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [collabs, setCollabs] = useState<CollabUser[]>([]);
  const [healthTag, setHealthTag] = useState<HealthTag | null>(null);
  const [uploading, setUploading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<{ captions: string[]; hashtags: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const suggestCaptions = async () => {
    setSuggesting(true);
    setSuggestions(null);
    try {
      const pet = pets?.find((p) => p.id === petId);
      const { data, error } = await supabase.functions.invoke("ai-suggest-caption", {
        body: {
          draft: caption,
          pet_name: pet?.name,
          pet_species: pet?.species,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setSuggestions(data);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not get suggestions");
    } finally {
      setSuggesting(false);
    }
  };

  const onFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return toast.error("Image must be under 8 MB");
    setFile(f);
    setPreview(URL.createObjectURL(f));
    // Smart auto-detect: prompt to log as health if no tag yet
    if (!healthTag && pets && pets.length > 0) {
      const hour = new Date().getHours();
      const txt = caption.toLowerCase();
      let kind: HealthTag["kind"] | null = null;
      if (/\b(walk|walking|park|stroll)\b/.test(txt)) kind = "walk";
      else if (/\b(meal|food|breakfast|lunch|dinner|kibble|treat)\b/.test(txt)) kind = "meal";
      else if (/\b(weigh|weight|scale|kg)\b/.test(txt)) kind = "weight";
      else if (/\b(itch|scratch|vomit|cough|sneeze|symptom|sick)\b/.test(txt)) kind = "symptom";
      else if (hour < 10) kind = "meal";
      else if (hour >= 16 && hour < 20) kind = "walk";
      if (kind) {
        const targetPetId = petId !== "none" ? petId : pets[0].id;
        setHealthTag({ kind, pet_id: targetPetId, value: null });
        toast.message(`Suggested: log as ${kind}`, { description: "Tap the health tag to confirm or change." });
      }
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error("Please sign in");
    if (!caption.trim() && !file) return toast.error("Add a caption or photo");
    setUploading(true);
    try {
      let image_url: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("posts").upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from("posts").getPublicUrl(path);
        image_url = publicUrl;
      }
      const { data: post, error } = await supabase.from("posts").insert({
        author_id: user.id,
        pet_id: petId === "none" ? null : petId,
        caption: caption.trim() || null,
        image_url,
        health_kind: healthTag?.kind ?? null,
        health_pet_id: healthTag?.pet_id ?? null,
        health_value: healthTag?.value ?? null,
      } as any).select().single();
      if (error) throw error;
      if (collabs.length && post) {
        await invite.mutateAsync({ postId: post.id, userIds: collabs.map((c) => c.id) });
      }
      toast.success(healthTag ? "Posted & logged to health" : "Posted");
      qc.invalidateQueries({ queryKey: ["feed"] });
      setCaption(""); setFile(null); setPreview(null); setPetId("none"); setCollabs([]); setHealthTag(null);
      onDone();
    } catch (err: any) {
      toast.error(err.message || "Could not post");
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="What's happening with your pet?"
        className="rounded-xl border-hairline min-h-[100px] resize-none"
        maxLength={500}
      />

      <div className="flex items-center justify-between gap-2 -mt-1">
        <button
          type="button"
          onClick={suggestCaptions}
          disabled={suggesting}
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-50"
        >
          {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {suggesting ? "Thinking…" : "AI suggest captions"}
        </button>
        <span className="text-[10px] text-muted-foreground">{caption.length}/500</span>
      </div>

      {suggestions && (
        <div className="rounded-xl border border-hairline bg-muted/30 p-3 space-y-2 animate-in fade-in slide-in-from-top-1">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tap to use</div>
          {suggestions.captions.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setCaption(c); setSuggestions(null); }}
              className="w-full text-left text-sm px-3 py-2 rounded-lg bg-background border border-hairline hover:bg-card transition-colors"
            >
              {c}
            </button>
          ))}
          {suggestions.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {suggestions.hashtags.map((h, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCaption((prev) => `${prev}${prev.endsWith(" ") || !prev ? "" : " "}#${h} `)}
                  className="text-xs px-2 py-1 rounded-full bg-primary-soft text-primary"
                >
                  #{h}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {preview && (
        <div className="relative rounded-xl overflow-hidden bg-muted">
          <img src={preview} alt="" className="w-full max-h-72 object-cover" />
          <button
            type="button"
            onClick={() => { setFile(null); setPreview(null); }}
            className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/90 flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="rounded-xl border-hairline gap-2">
          <ImagePlus className="h-4 w-4" /> Photo
        </Button>
        {pets && pets.length > 0 && (
          <Select value={petId} onValueChange={setPetId}>
            <SelectTrigger className="h-9 rounded-xl border-hairline flex-1 text-sm"><SelectValue placeholder="Tag a pet" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No pet tag</SelectItem>
              {pets.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <CollabPicker selected={collabs} onChange={setCollabs} />

      {pets && pets.length > 0 && (
        <HealthTagPicker pets={pets} value={healthTag} onChange={setHealthTag} />
      )}

      <Button type="submit" disabled={uploading} size="lg" className="w-full rounded-xl">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Share"}
      </Button>
    </form>
  );
};
