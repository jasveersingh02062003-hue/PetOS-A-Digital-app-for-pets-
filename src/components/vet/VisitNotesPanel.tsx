import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function VisitNotesPanel({
  appointmentId,
  initialNotes,
}: {
  appointmentId: string;
  initialNotes: string | null | undefined;
}) {
  const [value, setValue] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Re-sync if prop changes (realtime update)
  useEffect(() => {
    setValue(initialNotes ?? "");
  }, [initialNotes]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("appointments")
      .update({ vet_visit_notes: value })
      .eq("id", appointmentId);
    setSaving(false);
    if (error) return toast.error(error.message);
    setSavedAt(new Date());
    toast.success("Visit notes saved");
  };

  return (
    <Card className="mx-4 mt-3 p-4 rounded-2xl border-hairline">
      <div className="flex items-center gap-2 mb-2">
        <Stethoscope className="h-4 w-4 text-primary" />
        <div className="font-medium text-sm">Visit notes (vet only)</div>
        {savedAt && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            Saved {savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Subjective findings, exam, assessment, plan…"
        rows={4}
        className="rounded-xl text-sm"
      />
      <div className="flex justify-end mt-2">
        <Button size="sm" variant="outline" onClick={save} disabled={saving} className="rounded-full">
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Save
        </Button>
      </div>
    </Card>
  );
}