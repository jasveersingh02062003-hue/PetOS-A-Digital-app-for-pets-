import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type Props = {
  consultId: string;
  vetId: string | null;
  status: string;
  prescription: string | null;
  notes: string | null;
};

export const VetControls = ({ consultId, vetId, status, prescription, notes }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [presc, setPresc] = useState(prescription || "");
  const [note, setNote] = useState(notes || "");
  const [saving, setSaving] = useState(false);

  // Only show if current user is the assigned vet (or admin sees a generic "claim")
  const isAssignedVet = !!user && vetId === user.id;

  const claim = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("vet_consults")
      .update({ vet_id: user.id, status: "assigned" })
      .eq("id", consultId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Consult claimed");
    qc.invalidateQueries({ queryKey: ["consult", consultId] });
  };

  const update = async (next: { status?: string; complete?: boolean }) => {
    setSaving(true);
    const payload: any = {
      prescription: presc || null,
      notes: note || null,
    };
    if (next.status) payload.status = next.status;
    if (next.complete) {
      payload.status = "completed";
      payload.completed_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from("vet_consults")
      .update(payload)
      .eq("id", consultId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["consult", consultId] });
  };

  if (status === "awaiting_vet" && !vetId) {
    return (
      <Card className="rounded-2xl border-hairline p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
          Vet actions
        </div>
        <Button onClick={claim} disabled={saving} className="w-full rounded-full">
          Claim consult
        </Button>
      </Card>
    );
  }

  if (!isAssignedVet) return null;
  if (status === "completed" || status === "cancelled") return null;

  return (
    <Card className="rounded-2xl border-hairline p-4 space-y-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        Vet actions
      </div>
      <div className="space-y-1.5">
        <Label>Prescription</Label>
        <Textarea
          value={presc}
          onChange={(e) => setPresc(e.target.value)}
          rows={3}
          placeholder="Medication, dosage, duration…"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Internal notes for the owner"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {status === "assigned" && (
          <Button
            variant="outline"
            className="rounded-full"
            disabled={saving}
            onClick={() => update({ status: "in_progress" })}
          >
            Start consult
          </Button>
        )}
        <Button
          variant="outline"
          className="rounded-full"
          disabled={saving}
          onClick={() => update({})}
        >
          Save draft
        </Button>
        <Button
          className={status === "in_progress" ? "rounded-full col-span-2" : "rounded-full"}
          disabled={saving}
          onClick={() => update({ complete: true })}
        >
          Mark completed
        </Button>
      </div>
    </Card>
  );
};
