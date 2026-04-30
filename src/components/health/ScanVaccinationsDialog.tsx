import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Sparkles, Upload, Trash2, Check } from "lucide-react";

type Draft = {
  vaccine_name: string;
  administered_on: string | null;
  next_due_on: string | null;
  vet_name: string | null;
  batch_number: string | null;
  notes: string | null;
};

const MAX_BYTES = 6 * 1024 * 1024; // 6MB raw

export const ScanVaccinationsDialog = ({
  open,
  onOpenChange,
  petId,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  petId: string;
}) => {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => { setDrafts(null); setPreviewUrl(null); };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      return toast.error("Please upload a photo of the card (JPG/PNG). For PDFs, take a screenshot first.");
    }
    if (file.size > MAX_BYTES) {
      return toast.error("Image too large. Keep under 6MB.");
    }
    setParsing(true);
    try {
      // Downscale large images to keep base64 under 6MB
      const dataUrl = await downscaleImage(file, 1600);
      setPreviewUrl(dataUrl);
      const { data, error } = await supabase.functions.invoke("ai-parse-vaccinations", {
        body: { imageDataUrl: dataUrl },
      });
      if (error) throw error;
      const list = (data?.vaccinations ?? []) as Draft[];
      if (!list.length) {
        toast.error("No vaccinations detected. Try a clearer photo.");
        setDrafts([]);
      } else {
        toast.success(`Found ${list.length} vaccination${list.length > 1 ? "s" : ""}`);
        setDrafts(list);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't parse image");
    } finally {
      setParsing(false);
    }
  };

  const updateDraft = (i: number, patch: Partial<Draft>) => {
    setDrafts((d) => d?.map((row, idx) => (idx === i ? { ...row, ...patch } : row)) ?? null);
  };

  const removeDraft = (i: number) => {
    setDrafts((d) => d?.filter((_, idx) => idx !== i) ?? null);
  };

  const saveAll = async () => {
    if (!drafts?.length) return;
    const invalid = drafts.find((d) => !d.vaccine_name?.trim() || !d.administered_on);
    if (invalid) return toast.error("Each entry needs a name and date given");
    setSaving(true);
    const rows = drafts.map((d) => ({
      pet_id: petId,
      vaccine_name: d.vaccine_name.trim(),
      administered_on: d.administered_on!,
      next_due_on: d.next_due_on || null,
      vet_name: d.vet_name?.trim() || null,
      batch_number: d.batch_number?.trim() || null,
      notes: d.notes?.trim() || null,
    }));
    const { error } = await supabase.from("vaccinations").insert(rows);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Added ${rows.length} vaccination${rows.length > 1 ? "s" : ""}`);
    qc.invalidateQueries({ queryKey: ["vaccinations", petId] });
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="rounded-2xl max-w-lg max-h-[90dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Scan vaccination card
          </DialogTitle>
        </DialogHeader>

        {!drafts && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Snap or upload a photo of your pet's vaccination card. AI will extract every entry — you review before saving.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={parsing}
              size="lg"
              className="w-full rounded-xl gap-2 h-14"
            >
              {parsing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              {parsing ? "Reading card…" : "Choose photo"}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Tip: lay the card flat with even light. JPG or PNG, up to 6MB.
            </p>
          </div>
        )}

        {drafts && (
          <>
            {previewUrl && (
              <img src={previewUrl} alt="Card preview" className="rounded-xl max-h-32 object-contain mx-auto border border-hairline" loading="lazy" decoding="async" />
            )}
            <div className="text-xs text-muted-foreground">
              Review and edit each entry, then save. {drafts.length === 0 && "Nothing detected — try again with a clearer photo."}
            </div>
            <ScrollArea className="flex-1 -mx-2 px-2">
              <div className="space-y-3 pr-1">
                {drafts.map((d, i) => (
                  <Card key={i} className="rounded-xl border-hairline p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        value={d.vaccine_name}
                        onChange={(e) => updateDraft(i, { vaccine_name: e.target.value })}
                        placeholder="Vaccine"
                        className="h-9 rounded-lg border-hairline font-medium flex-1"
                      />
                      <Button variant="ghost" size="icon" onClick={() => removeDraft(i)} className="rounded-full text-muted-foreground hover:text-destructive shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Date given</Label>
                        <Input type="date" value={d.administered_on ?? ""} onChange={(e) => updateDraft(i, { administered_on: e.target.value || null })} className="h-9 rounded-lg border-hairline" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Next due</Label>
                        <Input type="date" value={d.next_due_on ?? ""} onChange={(e) => updateDraft(i, { next_due_on: e.target.value || null })} className="h-9 rounded-lg border-hairline" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={d.vet_name ?? ""} onChange={(e) => updateDraft(i, { vet_name: e.target.value })} placeholder="Vet name" className="h-9 rounded-lg border-hairline text-xs" />
                      <Input value={d.batch_number ?? ""} onChange={(e) => updateDraft(i, { batch_number: e.target.value })} placeholder="Batch / lot" className="h-9 rounded-lg border-hairline text-xs" />
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
            <div className="flex gap-2 pt-2 border-t border-hairline">
              <Button variant="outline" onClick={reset} className="flex-1 rounded-xl border-hairline">
                Try again
              </Button>
              <Button onClick={saveAll} disabled={saving || drafts.length === 0} className="flex-1 rounded-xl gap-1">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save {drafts.length || ""}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

/** Resize an image File to maxDim on the longest side and return a JPEG data URL. */
async function downscaleImage(file: File, maxDim: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}