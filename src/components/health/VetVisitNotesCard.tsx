import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, Plus, Loader2, Calendar, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PhotoUploadField, PhotoThumbs } from "./PhotoUploadField";

/**
 * VetVisitNotesCard — visible on a pet's Health page for both owners and care-team vets.
 * Owners see notes read-only. Care-team vets see an "Add visit note" button and can edit/delete
 * their own notes.
 */
export function VetVisitNotesCard({ petId }: { petId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: isCareTeamVet } = useQuery({
    queryKey: ["is-care-team-vet", petId, user?.id],
    enabled: !!user && !!petId,
    queryFn: async () => {
      const { data } = await supabase
        .from("pet_care_team" as any)
        .select("id")
        .eq("pet_id", petId)
        .eq("vet_id", user!.id)
        .is("revoked_at", null)
        .maybeSingle();
      return !!data;
    },
  });

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["vet-visit-notes", petId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vet_visit_notes" as any)
        .select("*")
        .eq("pet_id", petId)
        .order("visit_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const remove = async (id: string) => {
    const { error } = await supabase.from("vet_visit_notes" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Note deleted");
    qc.invalidateQueries({ queryKey: ["vet-visit-notes", petId] });
  };

  return (
    <Card className="rounded-2xl border-hairline p-4 mb-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-primary" />
          <span className="font-display text-base">Vet visit notes</span>
        </div>
        {isCareTeamVet && (
          <Button size="sm" className="rounded-full gap-1" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add note
          </Button>
        )}
      </div>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : notes.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          {isCareTeamVet
            ? "No visit notes yet. Add one after a consult so the owner has a clear record."
            : "No vet visit notes yet. Notes added by your care-team vets will appear here."}
        </p>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="rounded-xl border border-hairline p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {format(new Date(n.visit_date), "d MMM yyyy")}
                  {n.follow_up_on && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      Follow-up {format(new Date(n.follow_up_on), "d MMM")}
                    </Badge>
                  )}
                </div>
                {n.vet_id === user?.id && (
                  <button onClick={() => remove(n.id)} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <NoteSection label="Subjective" text={n.subjective} />
              <NoteSection label="Objective" text={n.objective} />
              <NoteSection label="Assessment" text={n.assessment} />
              <NoteSection label="Plan" text={n.plan} />
              <PhotoThumbs paths={n.photo_paths} />
            </div>
          ))}
        </div>
      )}

      <VisitNoteDialog open={open} onOpenChange={setOpen} petId={petId} />
    </Card>
  );
}

function NoteSection({ label, text }: { label: string; text?: string | null }) {
  if (!text) return null;
  return (
    <div className="mt-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <p className="text-sm whitespace-pre-wrap">{text}</p>
    </div>
  );
}

function VisitNoteDialog({ open, onOpenChange, petId }: { open: boolean; onOpenChange: (b: boolean) => void; petId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    visit_date: new Date().toISOString().slice(0, 10),
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
    follow_up_on: "",
    photo_paths: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.assessment.trim() && !form.plan.trim() && !form.subjective.trim()) {
      return toast.error("Add at least one note section");
    }
    setSaving(true);
    const { error } = await supabase.from("vet_visit_notes" as any).insert({
      pet_id: petId,
      vet_id: user!.id,
      visit_date: form.visit_date,
      subjective: form.subjective.trim() || null,
      objective: form.objective.trim() || null,
      assessment: form.assessment.trim() || null,
      plan: form.plan.trim() || null,
      follow_up_on: form.follow_up_on || null,
      photo_paths: form.photo_paths.length ? form.photo_paths : null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Visit note saved");
    qc.invalidateQueries({ queryKey: ["vet-visit-notes", petId] });
    onOpenChange(false);
    setForm({ visit_date: new Date().toISOString().slice(0, 10), subjective: "", objective: "", assessment: "", plan: "", follow_up_on: "", photo_paths: [] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Add visit note</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Visit date" type="date" value={form.visit_date} onChange={(v) => setForm({ ...form, visit_date: v })} />
            <Field label="Follow-up on" type="date" value={form.follow_up_on} onChange={(v) => setForm({ ...form, follow_up_on: v })} />
          </div>
          <Area label="Subjective (owner reports)" value={form.subjective} onChange={(v) => setForm({ ...form, subjective: v })} />
          <Area label="Objective (exam findings)" value={form.objective} onChange={(v) => setForm({ ...form, objective: v })} />
          <Area label="Assessment / diagnosis" value={form.assessment} onChange={(v) => setForm({ ...form, assessment: v })} />
          <Area label="Plan / treatment" value={form.plan} onChange={(v) => setForm({ ...form, plan: v })} />
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Photos / scans</Label>
            <PhotoUploadField value={form.photo_paths} onChange={(p) => setForm({ ...form, photo_paths: p })} />
          </div>
          <Button type="submit" disabled={saving} size="lg" className="w-full rounded-xl">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save note"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} className="h-11 rounded-xl border-hairline" />
    </div>
  );
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} className="rounded-xl border-hairline min-h-[60px]" />
    </div>
  );
}