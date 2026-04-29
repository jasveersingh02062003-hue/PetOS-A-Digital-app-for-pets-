import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  providerId: string;
  providerName: string;
};

export const BookingSheet = ({ open, onOpenChange, providerId, providerName }: Props) => {
  const { user } = useAuth();
  const [petId, setPetId] = useState<string>("");
  const [when, setWhen] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState<"weekly" | "biweekly" | "monthly">("weekly");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [endDate, setEndDate] = useState<string>("");

  const { data: pets } = useQuery({
    queryKey: ["my-pets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("id, name")
        .eq("owner_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user && open,
  });

  // Load provider's category to know if boarding/daycare gating applies
  const { data: provider } = useQuery({
    queryKey: ["provider-category", providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_providers")
        .select("category")
        .eq("id", providerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!providerId,
  });
  const requiresVaccGate = provider?.category === "boarding" || provider?.category === "daycare";

  // Check vaccination eligibility for the chosen pet when gate applies
  const { data: eligibility, isFetching: checkingElig } = useQuery({
    queryKey: ["boarding-eligible", petId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("check_pet_boarding_eligible" as any, { _pet_id: petId });
      if (error) throw error;
      return data as { eligible: boolean; missing?: string[]; reason?: string };
    },
    enabled: !!petId && requiresVaccGate,
  });

  const submit = async () => {
    if (!user) {
      toast.error("Please sign in first");
      return;
    }
    if (!when) {
      toast.error("Pick a date & time");
      return;
    }
    if (requiresVaccGate) {
      if (!petId) {
        toast.error("Choose a pet — boarding requires vaccination check");
        return;
      }
      if (eligibility && !eligibility.eligible) {
        toast.error(`Pet not eligible for boarding. Missing: ${(eligibility.missing ?? []).join(", ") || "vaccinations"}`);
        return;
      }
    }
    if (recurring && weekdays.length === 0) {
      toast.error("Pick at least one weekday for the recurring schedule");
      return;
    }
    setSaving(true);
    const startDt = new Date(when);
    let recurringId: string | null = null;
    if (recurring) {
      const { data: rec, error: recErr } = await supabase.from("recurring_bookings").insert({
        customer_id: user.id,
        provider_id: providerId,
        pet_id: petId || null,
        frequency,
        weekdays,
        time_of_day: startDt.toTimeString().slice(0, 8),
        start_date: startDt.toISOString().slice(0, 10),
        end_date: endDate || null,
        notes: notes || null,
      }).select("id").single();
      if (recErr) { setSaving(false); toast.error(recErr.message); return; }
      recurringId = rec.id;
    }
    const { error } = await supabase.from("service_bookings").insert({
      provider_id: providerId,
      customer_id: user.id,
      pet_id: petId || null,
      scheduled_at: startDt.toISOString(),
      notes: notes || null,
      parent_recurring_id: recurringId,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(recurring ? "Recurring booking created" : "Booking requested");
    onOpenChange(false);
    setNotes("");
    setWhen("");
    setRecurring(false);
    setWeekdays([]);
    setEndDate("");
  };

  const toggleDay = (d: number) =>
    setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort()));

  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-display">Book {providerName}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label>Pet (optional)</Label>
            <Select value={petId} onValueChange={setPetId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a pet" />
              </SelectTrigger>
              <SelectContent>
                {pets?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {requiresVaccGate && petId && (
            <Card className={`rounded-xl p-3 border ${eligibility?.eligible ? "bg-leaf/10 border-leaf/30" : "bg-amber-500/10 border-amber-500/30"}`}>
              <div className={`flex items-start gap-2 text-xs leading-relaxed ${eligibility?.eligible ? "text-leaf" : "text-amber-700"}`}>
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                {checkingElig ? (
                  <span>Checking vaccination records…</span>
                ) : eligibility?.eligible ? (
                  <span>Pet meets boarding vaccination requirements.</span>
                ) : (
                  <span>
                    Pet missing required vaccinations: <strong>{(eligibility?.missing ?? []).join(", ") || "DHPP and Rabies"}</strong>.
                    Add records under Health → Vaccinations before booking.
                  </span>
                )}
              </div>
            </Card>
          )}
          <div className="space-y-1.5">
            <Label>When</Label>
            <Input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              placeholder="Any special instructions"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Card className="rounded-xl border-hairline p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Repeat this booking</div>
                <div className="text-xs text-muted-foreground">Set up a recurring schedule</div>
              </div>
              <Switch checked={recurring} onCheckedChange={setRecurring} />
            </div>

            {recurring && (
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs">Frequency</Label>
                  <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Days of week</Label>
                  <div className="flex gap-1.5">
                    {dayLabels.map((d, i) => {
                      const active = weekdays.includes(i);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => toggleDay(i)}
                          className={`h-9 w-9 rounded-full text-xs font-medium border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-hairline text-muted-foreground"}`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">End date (optional)</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
            )}
          </Card>

          <Button
            onClick={submit}
            disabled={saving || (requiresVaccGate && (!petId || !eligibility?.eligible))}
            className="w-full rounded-full h-12"
          >
            {saving ? "Sending…" : recurring ? "Create recurring booking" : "Request booking"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
