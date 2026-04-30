import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Pill, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

type Props = {
  appointmentId?: string | null;
  petId: string;
  ownerId: string;
  /** Hide the surrounding Card chrome when embedding inside a Dialog */
  embedded?: boolean;
  onSaved?: () => void;
};

export const PrescriptionBuilder = ({ appointmentId, petId, ownerId, embedded, onSaved }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(!!embedded);
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");

  const { data: existing } = useQuery({
    queryKey: ["rx-for-appt", appointmentId ?? `pet:${petId}`],
    enabled: !!appointmentId || embedded === true,
    queryFn: async () => {
      let q = supabase
        .from("pharmacy_suggestions" as any)
        .select("id, med_name, dose, frequency, duration, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      if (appointmentId) q = q.eq("appointment_id", appointmentId);
      else q = q.eq("pet_id", petId);
      const { data } = await q;
      return (data ?? []) as any[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in");
      if (!name.trim()) throw new Error("Medicine name required");
      // 1) write to medication_logs
      const { data: med, error: medErr } = await supabase
        .from("medication_logs" as any)
        .insert({
          pet_id: petId,
          name: name.trim(),
          dose: dose || null,
          frequency: frequency || null,
          appointment_id: appointmentId ?? null,
          prescribed_by_vet_id: user.id,
          reason: notes || null,
        })
        .select("id")
        .single();
      if (medErr) throw medErr;
      // 2) write a pharmacy suggestion for the owner
      const { error: pErr } = await supabase.from("pharmacy_suggestions" as any).insert({
        owner_id: ownerId,
        pet_id: petId,
        vet_id: user.id,
        appointment_id: appointmentId ?? null,
        medication_log_id: (med as any).id,
        med_name: name.trim(),
        dose: dose || null,
        frequency: frequency || null,
        duration: duration || null,
        notes: notes || null,
      });
      if (pErr) throw pErr;
    },
    onSuccess: () => {
      toast.success("Prescription saved");
      setName(""); setDose(""); setFrequency(""); setDuration(""); setNotes("");
      if (!embedded) setOpen(false);
      qc.invalidateQueries({ queryKey: ["rx-for-appt", appointmentId ?? `pet:${petId}`] });
      qc.invalidateQueries({ queryKey: ["pharmacy-suggestions"] });
      onSaved?.();
    },
    onError: (e: any) => toast.error(e.message ?? "Could not save"),
  });

  const body = (
    <>
      <div className="flex items-center gap-2 mb-2">
        <Pill className="h-4 w-4 text-primary" />
        <div className="font-medium text-sm">Prescriptions</div>
        {!embedded && (
          <Button size="sm" variant="ghost" className="ml-auto h-7 rounded-full text-xs" onClick={() => setOpen((v) => !v)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> {open ? "Close" : "Add"}
          </Button>
        )}
      </div>

      {existing && existing.length > 0 && (
        <ul className="space-y-1 mb-2">
          {existing.map((rx) => (
            <li key={rx.id} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{rx.med_name}</span>
              {rx.dose ? ` · ${rx.dose}` : ""}{rx.frequency ? ` · ${rx.frequency}` : ""}{rx.duration ? ` · ${rx.duration}` : ""}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Medicine</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amoxicillin" className="h-9" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Dose</Label><Input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="250mg" className="h-9" /></div>
            <div><Label className="text-xs">Freq</Label><Input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="2x/day" className="h-9" /></div>
            <div><Label className="text-xs">Duration</Label><Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="7 days" className="h-9" /></div>
          </div>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes / reason" className="min-h-[60px] text-sm" />
          <Button size="sm" className="w-full rounded-full" disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save prescription"}
          </Button>
        </div>
      )}
    </>
  );

  if (embedded) return <div className="space-y-2">{body}</div>;
  return <Card className="mx-4 mt-3 rounded-2xl border-hairline p-4">{body}</Card>;
};
