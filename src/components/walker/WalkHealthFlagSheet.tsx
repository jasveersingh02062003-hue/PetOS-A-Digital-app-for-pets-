import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";

const QUICK = [
  "Limping",
  "Vomiting",
  "Excessive panting",
  "Refused to walk",
  "Bleeding / cut",
  "Diarrhea",
];

/**
 * Walker-side: log a health concern during an active walk.
 * Insert into walk_events; DB trigger creates a vet booking_suggestion
 * for the owner and pushes a notification.
 */
export function WalkHealthFlagSheet({
  open,
  onOpenChange,
  bookingId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bookingId: string;
}) {
  const { user } = useAuth();
  const [tag, setTag] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) return;
    const text = [tag, note.trim()].filter(Boolean).join(" — ");
    if (!text) return toast.error("Add a quick tag or a note");
    setSaving(true);
    const { error } = await supabase.from("walk_events").insert({
      booking_id: bookingId,
      author_id: user.id,
      kind: "health_flag",
      payload: { note: text, tag },
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Owner notified — vet follow-up suggested");
    setTag(null);
    setNote("");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Flag a health concern
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-3">
          <div className="flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setTag(tag === q ? null : q)}
                className={`rounded-full px-3 py-1.5 text-sm border ${
                  tag === q
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-hairline"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
          <Textarea
            placeholder="Anything else the owner should know? (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            The owner gets an instant push and a one-tap "Book vet" card on their home screen.
          </p>
          <Button onClick={submit} disabled={saving} className="w-full rounded-full">
            {saving ? "Sending…" : "Send to owner"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}