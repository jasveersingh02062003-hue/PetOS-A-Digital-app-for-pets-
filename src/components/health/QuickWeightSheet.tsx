import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Scale } from "lucide-react";
import { toast } from "sonner";
import { useUnits } from "@/hooks/useUnits";

/**
 * QuickWeightSheet — one-tap weight entry that writes to vital_logs.
 * Triggered from anywhere on the Health page so owners don't need to dig
 * into the Vitals tab dialog for a single number.
 */
export function QuickWeightSheet({
  open,
  onOpenChange,
  petId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  petId: string;
}) {
  const qc = useQueryClient();
  const { weightUnit, parseWeightToKg } = useUnits();
  const [weight, setWeight] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const kg = parseWeightToKg(weight);
    if (!kg || kg <= 0 || kg > 200) return toast.error(`Enter a valid weight (${weightUnit})`);
    setSaving(true);
    const { error } = await supabase.from("vital_logs").insert({
      pet_id: petId,
      weight_kg: kg,
      recorded_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Weight logged");
    qc.invalidateQueries({ queryKey: ["vitals", petId] });
    qc.invalidateQueries({ queryKey: ["health-status", petId] });
    setWeight("");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-hairline">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-xl flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" /> Quick weight
          </SheetTitle>
          <SheetDescription>Logs to vitals — appears on the timeline and weight chart.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 mt-4 pb-6">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Weight ({weightUnit})</Label>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              autoFocus
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={weightUnit === "lb" ? "e.g. 27.3" : "e.g. 12.4"}
              className="h-14 rounded-xl border-hairline text-2xl font-display"
            />
          </div>
          <Button onClick={submit} disabled={saving || !weight} size="lg" className="w-full rounded-xl h-12">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save weight"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}