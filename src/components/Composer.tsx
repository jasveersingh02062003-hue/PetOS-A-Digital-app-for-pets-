import { useState, useRef, useEffect, forwardRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePets, useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import {
  Camera, ImagePlus, X, Loader2, Plus, Sparkles, Globe, Users, Lock,
  GripVertical, Clock, CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { CollabPicker, type CollabUser } from "@/components/social/CollabPicker";
import { useInviteCollaborators } from "@/hooks/useCollabs";
import { HealthTagPicker, type HealthTag } from "@/components/health/HealthTagPicker";
import { uploadImageWithVariants } from "@/lib/uploadImage";
import { getRoleSubmit, getRoleComposerCopy, isOrgRole } from "@/lib/roleTheme";
import { RescueJourneyPicker } from "@/components/rescue/RescueJourneyPicker";
import { StoryComposer } from "@/components/social/StoryComposer";

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
  const nav = useNavigate();
  const { data: pets } = usePets();
  const { data: profile } = useProfile();
  const accountType = profile?.account_type ?? "pet_parent";
  const orgRole = isOrgRole(accountType);
  const copy = getRoleComposerCopy(accountType);
  const submitClass = getRoleSubmit(accountType);
  // Pet-tag + health-log only make sense for accounts that own pets.
  const showPetTag = !orgRole && (pets?.length ?? 0) > 0;
  const canRescueJourney = ["shelter", "rescuer", "sanctuary"].includes(accountType);
  const qc = useQueryClient();
  const invite = useInviteCollaborators();
  const [caption, setCaption] = useState("");
  const [petId, setPetId] = useState<string>("none");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<"public" | "followers" | "private">("public");
  const [storyOpen, setStoryOpen] = useState(false);
  const [collabs, setCollabs] = useState<CollabUser[]>([]);
  const [healthTag, setHealthTag] = useState<HealthTag | null>(null);
  const [rescueJourneyId, setRescueJourneyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<{ captions: string[]; hashtags: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);

  // ---- @mention / #hashtag autocomplete ----
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [hashQuery, setHashQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<{ id: string; full_name: string | null }[]>([]);

  useEffect(() => {
    if (mentionQuery == null) { setMentionResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.rpc("get_profiles_public");
        const q = mentionQuery.toLowerCase();
        const matches = ((data ?? []) as any[])
          .filter((p) => (p.full_name ?? "").toLowerCase().includes(q))
          .slice(0, 6);
        setMentionResults(matches);
      } catch { setMentionResults([]); }
    }, 180);
    return () => clearTimeout(t);
  }, [mentionQuery]);

  const onCaptionChange = (val: string) => {
    setCaption(val);
    const ta = captionRef.current;
    const cursor = ta ? ta.selectionStart : val.length;
    const upTo = val.slice(0, cursor);
    const mMatch = upTo.match(/(?:^|\s)@([\w.]{1,30})$/);
    const hMatch = upTo.match(/(?:^|\s)#([\w]{1,30})$/);
    setMentionQuery(mMatch ? mMatch[1] : null);
    setHashQuery(hMatch ? hMatch[1] : null);
  };

  const insertAtToken = (replacement: string) => {
    const ta = captionRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart;
    const before = caption.slice(0, cursor);
    const after = caption.slice(cursor);
    // Strip the in-progress token (e.g. "@bru" or "#lab")
    const stripped = before.replace(/(@|#)[\w.]*$/, "");
    const next = `${stripped}${replacement} ${after}`;
    setCaption(next);
    setMentionQuery(null);
    setHashQuery(null);
    requestAnimationFrame(() => {
      const pos = stripped.length + replacement.length + 1;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  const TRENDING_HASHTAGS = [
    "petsofpetos", "morningwalk", "labradorlife", "catsofinstagram",
    "rescuepup", "trainingday", "vetvisit", "happypets",
  ];
  const hashSuggestions = hashQuery == null ? [] :
    TRENDING_HASHTAGS.filter((h) => h.includes(hashQuery.toLowerCase())).slice(0, 6);

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
    setFiles((prev) => [...prev, f].slice(0, 6));
    setPreviews((prev) => [...prev, URL.createObjectURL(f)].slice(0, 6));
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

  const onFiles = (list: FileList | null) => {
    if (!list) return;
    Array.from(list).slice(0, 6 - files.length).forEach((f) => onFile(f));
  };

  const removeFileAt = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveFile = (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= files.length) return;
    const nf = [...files]; const np = [...previews];
    [nf[from], nf[to]] = [nf[to], nf[from]];
    [np[from], np[to]] = [np[to], np[from]];
    setFiles(nf); setPreviews(np);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error("Please sign in");
    if (!caption.trim() && files.length === 0) return toast.error("Add a caption or photo");
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
      let image_url_thumb: string | null = null;
      let image_url_feed: string | null = null;
      let image_url_full: string | null = null;
      let image_urls: { thumb: string; feed: string; full: string }[] | null = null;
      if (files.length > 0) {
        const uploaded = [];
        for (const f of files) {
          uploaded.push(await uploadImageWithVariants(f, "posts"));
        }
        const v = uploaded[0];
        image_url_thumb = v.thumb;
        image_url_feed = v.feed;
        image_url_full = v.full;
        image_url = v.feed; // keep legacy column populated for backwards compat
        if (uploaded.length > 1) image_urls = uploaded;
      }
      // Zoo accounts: every post is auto-tagged #educational so PetOS can flag
      // wildlife content as informational, not commercial.
      let finalCaption = caption.trim() || null;
      if (accountType === "zoo" && finalCaption && !/#educational\b/i.test(finalCaption)) {
        finalCaption = `${finalCaption} #educational`;
      } else if (accountType === "zoo" && !finalCaption) {
        finalCaption = "#educational";
      }
      const { data: post, error } = await supabase.from("posts").insert({
        author_id: user.id,
        pet_id: petId === "none" ? null : petId,
        caption: finalCaption,
        image_url,
        image_url_thumb,
        image_url_feed,
        image_url_full,
        image_urls: image_urls as any,
        visibility,
        health_kind: healthTag?.kind ?? null,
        health_pet_id: healthTag?.pet_id ?? null,
        health_value: healthTag?.value ?? null,
        rescue_journey_id: rescueJourneyId,
      } as any).select().single();
      if (error) throw error;
      if (collabs.length && post) {
        await invite.mutateAsync({ postId: post.id, userIds: collabs.map((c) => c.id) });
      }
      toast.success(healthTag ? "Posted & logged to health" : "Posted");
      qc.invalidateQueries({ queryKey: ["feed"] });
      setCaption(""); setFiles([]); setPreviews([]); setPetId("none");
      setCollabs([]); setHealthTag(null); setRescueJourneyId(null);
      setVisibility("public");
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
          <img src={preview} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
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
        placeholder={
          showPetTag && pets?.[0]
            ? `What's ${pets[0].name} up to?`
            : copy.placeholder
        }
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
        <div className="flex items-center gap-2">
          {accountType === "zoo" && (
            <span className="inline-flex items-center text-[10px] font-semibold text-stone-700 bg-stone-200/70 border border-stone-300 rounded-full px-2 py-0.5">
              Auto: #educational
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{caption.length}/500</span>
        </div>
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
      {showPetTag && (
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
                {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" /> : p.name[0]}
              </span>
              {p.name}
            </button>
          ))}
        </div>
      )}

      <CollabPicker selected={collabs} onChange={setCollabs} />

      {showPetTag && (
        <HealthTagPicker pets={pets} value={healthTag} onChange={setHealthTag} />
      )}

      {canRescueJourney && (
        <RescueJourneyPicker value={rescueJourneyId} onChange={setRescueJourneyId} />
      )}

      <Button
        type="submit"
        disabled={uploading}
        size="lg"
        className={`w-full rounded-2xl h-12 text-base font-semibold ${submitClass}`}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : copy.cta}
      </Button>
    </form>
  );
};
