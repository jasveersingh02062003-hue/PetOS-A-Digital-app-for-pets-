import { useState, useRef, useEffect, forwardRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { usePets } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { Camera, ImagePlus, X, Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { CollabPicker, type CollabUser } from "@/components/social/CollabPicker";
import { useInviteCollaborators } from "@/hooks/useCollabs";
import { HealthTagPicker, type HealthTag } from "@/components/health/HealthTagPicker";

export const ComposerButton = forwardRef<HTMLButtonElement, { variant?: "icon" | "fab" | "inline" | "global" }>(
  ({ variant = "icon" }, ref) => {
    const [open, setOpen] = useState(false);

    useEffect(() => {
      const handler = () => setOpen(true);
      window.addEventListener("petos:open-composer", handler);
      return () => window.removeEventListener("petos:open-composer", handler);
    }, []);

    if (variant === "global") {
      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader><DialogTitle className="font-display">New post</DialogTitle></DialogHeader>
            <Composer onDone={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      );
    }

    const trigger = variant === "fab" ? (
      <button ref={ref} className="fixed bottom-24 right-5 z-30 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform">
        <Plus className="h-6 w-6" />
      </button>
    ) : variant === "inline" ? (
      <Button ref={ref} variant="outline" className="w-full h-12 rounded-xl border-hairline justify-start text-muted-foreground gap-2">
        <ImagePlus className="h-4 w-4" /> Share a moment
      </Button>
    ) : (
      <Button ref={ref} variant="ghost" size="icon" className="rounded-full h-11 w-11 border border-hairline">
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
  }
);
ComposerButton.displayName = "ComposerButton";

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
      // Auto-moderation (best-effort; never blocks on backend errors)
      if (caption.trim().length > 0) {
        try {
          const { data: mod } = await supabase.functions.invoke("moderate-content", {
            body: { text: caption.trim(), content_type: "post" },
          });
          if (mod?.verdict === "block") {
            setUploading(false);
            return toast.error("Your post can't be shared.", {
              description: "It looks like it breaks our community rules. Please edit and try again.",
            });
          }
        } catch { /* fail-open */ }
      }

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
    <form onSubmit={submit} className="space-y-4">
      {/* IMAGE FIRST — big drop zone or preview */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      {preview ? (
        <div className="relative rounded-2xl overflow-hidden bg-muted aspect-square">
          <img src={preview} alt="" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => { setFile(null); setPreview(null); }}
            className="absolute top-2 right-2 h-9 w-9 rounded-full bg-background/95 flex items-center justify-center shadow-md"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-2 left-2 px-3 h-8 rounded-full bg-background/95 text-xs font-semibold flex items-center gap-1.5 shadow-md"
          >
            <ImagePlus className="h-3.5 w-3.5" /> Replace
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full aspect-square rounded-2xl border-2 border-dashed border-coral/30 bg-gradient-to-br from-coral/5 via-card to-amber/5 flex flex-col items-center justify-center gap-3 hover:border-coral/50 transition-colors active:scale-[0.99]"
        >
          <div className="h-14 w-14 rounded-2xl bg-coral/15 grid place-items-center">
            <Camera className="h-7 w-7 text-coral" strokeWidth={2} />
          </div>
          <div className="text-center">
            <div className="font-semibold text-base">Add a photo</div>
            <div className="text-xs text-muted-foreground mt-0.5">Tap to pick from your gallery</div>
          </div>
        </button>
      )}

      {/* CAPTION — secondary, below image */}
      <Textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder={pets?.[0] ? `What's ${pets[0].name} up to?` : "Write a caption…"}
        className="rounded-2xl border-hairline min-h-[72px] resize-none text-base"
        maxLength={500}
      />

      <div className="flex items-center justify-between gap-2 -mt-2">
        <button
          type="button"
          onClick={suggestCaptions}
          disabled={suggesting}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-lilac hover:underline disabled:opacity-50"
        >
          {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {suggesting ? "Thinking…" : "AI captions"}
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
                  className="text-xs px-2 py-1 rounded-full bg-lilac/15 text-lilac font-medium"
                >
                  #{h}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pet tag pills */}
      {pets && pets.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          <button
            type="button"
            onClick={() => setPetId("none")}
            className={`shrink-0 px-3 h-8 rounded-full text-xs font-semibold border transition-colors ${
              petId === "none" ? "bg-foreground text-background border-foreground" : "bg-card border-hairline text-muted-foreground"
            }`}
          >
            No pet
          </button>
          {pets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPetId(p.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 pl-1 pr-3 h-8 rounded-full text-xs font-semibold border transition-colors ${
                petId === p.id ? "bg-coral/15 text-coral border-coral/30" : "bg-card border-hairline text-foreground"
              }`}
            >
              <span className="h-6 w-6 rounded-full overflow-hidden bg-muted grid place-items-center text-[10px]">
                {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : p.name[0]}
              </span>
              {p.name}
            </button>
          ))}
        </div>
      )}

      <CollabPicker selected={collabs} onChange={setCollabs} />

      {pets && pets.length > 0 && (
        <HealthTagPicker pets={pets} value={healthTag} onChange={setHealthTag} />
      )}

      <Button
        type="submit"
        disabled={uploading}
        size="lg"
        className="w-full rounded-2xl h-12 text-base font-semibold bg-coral text-coral-foreground hover:bg-coral/90"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Share"}
      </Button>
    </form>
  );
};
