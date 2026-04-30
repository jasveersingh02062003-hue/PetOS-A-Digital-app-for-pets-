import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useUploadStory } from "@/hooks/useStories";
import { usePets, useProfile } from "@/hooks/useProfile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isOrgRole, getRoleSubmit, getRoleComposerCopy } from "@/lib/roleTheme";

export const StoryComposer = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const { data: pets } = usePets();
  const { data: profile } = useProfile();
  const accountType = profile?.account_type ?? "pet_parent";
  const orgRole = isOrgRole(accountType);
  const showPetTag = !orgRole && (pets?.length ?? 0) > 0;
  const submitClass = getRoleSubmit(accountType);
  const copy = getRoleComposerCopy(accountType);
  const upload = useUploadStory();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [petId, setPetId] = useState("none");

  const onFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return toast.error("Image must be under 8 MB");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!file) return toast.error("Pick an image");
    await upload.mutateAsync({
      file,
      caption: caption.trim(),
      petId: showPetTag && petId !== "none" ? petId : null,
    });
    setFile(null); setPreview(null); setCaption(""); setPetId("none");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle className="font-display">New story · 24h</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {preview ? (
            <div className="relative rounded-xl overflow-hidden bg-muted">
              <img src={preview} alt="" className="w-full max-h-80 object-cover" loading="lazy" decoding="async" />
              <button onClick={() => { setFile(null); setPreview(null); }} className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/90 flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full h-48 rounded-xl border-2 border-dashed border-hairline flex flex-col items-center justify-center text-muted-foreground gap-2"
            >
              <ImagePlus className="h-6 w-6" />
              <span className="text-sm">Tap to pick a photo</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />

          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={copy.placeholder}
            className="rounded-xl border-hairline resize-none"
            maxLength={140}
          />

          {showPetTag && (
            <Select value={petId} onValueChange={setPetId}>
              <SelectTrigger className="rounded-xl border-hairline"><SelectValue placeholder="Tag a pet" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No pet tag</SelectItem>
                {pets.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <Button
            onClick={submit}
            disabled={!file || upload.isPending}
            size="lg"
            className={`w-full rounded-xl ${submitClass}`}
          >
            {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Share story"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
