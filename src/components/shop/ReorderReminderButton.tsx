import { useState } from "react";
import { Bell, BellRing, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePets } from "@/hooks/useProfile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const PRESETS = [15, 30, 45, 60, 90];

type Props = { productId: string; productTitle: string; className?: string };

export function ReorderReminderButton({ productId, productTitle, className }: Props) {
  const { user } = useAuth();
  const { data: pets } = usePets();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [cadence, setCadence] = useState(30);
  const [petId, setPetId] = useState<string>("none");
  const [saving, setSaving] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ["shop-reminder", productId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("shop_reminders")
        .select("id, cadence_days, active")
        .eq("product_id", productId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const has = !!existing && existing.active;

  const save = async () => {
    if (!user) { toast.error("Sign in first"); return; }
    if (cadence < 7 || cadence > 180) { toast.error("Choose 7–180 days"); return; }
    setSaving(true);
    try {
      if (existing) {
        await supabase
          .from("shop_reminders")
          .update({ cadence_days: cadence, pet_id: petId === "none" ? null : petId, active: true })
          .eq("id", existing.id);
      } else {
        await supabase.from("shop_reminders").insert({
          user_id: user.id,
          product_id: productId,
          pet_id: petId === "none" ? null : petId,
          cadence_days: cadence,
          next_run_on: new Date(Date.now() + Math.max(cadence - 3, 1) * 86400000)
            .toISOString().slice(0, 10),
        });
      }
      toast.success("Reminder set");
      qc.invalidateQueries({ queryKey: ["shop-reminder", productId] });
      qc.invalidateQueries({ queryKey: ["shop-reminders"] });
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally { setSaving(false); }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={(e) => { e.stopPropagation(); setOpen(true); if (existing) setCadence(existing.cadence_days); }}
        className={className ?? "h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-primary"}
        aria-label="Set reorder reminder"
      >
        {has ? <BellRing className="h-3.5 w-3.5 text-primary" /> : <Bell className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{has ? "Reminder" : "Remind"}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Reorder reminder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground line-clamp-2">{productTitle}</div>

            <div>
              <Label className="text-xs">Remind me every</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {PRESETS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setCadence(d)}
                    className={`rounded-full px-3 py-1.5 text-sm border ${
                      cadence === d ? "bg-primary text-primary-foreground border-primary" : "border-hairline"
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
              <Input
                type="number"
                min={7}
                max={180}
                value={cadence}
                onChange={(e) => setCadence(parseInt(e.target.value || "0", 10))}
                className="mt-2 rounded-xl"
              />
              <p className="text-xs text-muted-foreground mt-1">We'll alert you 3 days before runout.</p>
            </div>

            {pets && pets.length > 0 && (
              <div>
                <Label className="text-xs">For pet (optional)</Label>
                <select
                  value={petId}
                  onChange={(e) => setPetId(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-hairline bg-background px-3 py-2 text-sm"
                >
                  <option value="none">— none —</option>
                  {pets.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {has && (
              <Button
                variant="outline"
                className="w-full rounded-xl"
                onClick={async () => {
                  if (!existing) return;
                  await supabase.from("shop_reminders").update({ active: false }).eq("id", existing.id);
                  toast.success("Reminder paused");
                  qc.invalidateQueries({ queryKey: ["shop-reminder", productId] });
                  qc.invalidateQueries({ queryKey: ["shop-reminders"] });
                  setOpen(false);
                }}
              >
                Pause reminder
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={saving} className="rounded-xl">
              <Check className="h-4 w-4 mr-1" /> {existing ? "Update" : "Set reminder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
