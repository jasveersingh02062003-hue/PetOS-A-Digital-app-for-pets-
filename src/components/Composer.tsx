import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { usePets } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, ImagePlus, X, Loader2, Plus } from "lucide-react";
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
