import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";
import { PhotoUploadField } from "./PhotoUploadField";

/**
 * VaxVerifyDialog — entry point for owners to request vaccination verification.
 * Reads existing requests so users see status, and lets them attach photos
 * of the vaccination card to support the review.
 */
export function VaxVerifyDialog({
  open,
  onOpenChange,
  petId,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  petId: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["vax-verify-requests", petId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vaccination_verification_requests" as any)
        .select("*")
        .eq("pet_id", petId)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const pending = requests.find((r) => r.status === "pending");

  const submit = async () => {
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from("vaccination_verification_requests" as any).insert({
      pet_id: petId,
      submitted_by: user.id,
      photo_paths: photos.length ? photos : null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Submitted — a vet on your care team will review it.");
    setPhotos([]);
    qc.invalidateQueries({ queryKey: ["vax-verify-requests", petId] });
    qc.invalidateQueries({ queryKey: ["pets"] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Verify vaccinations
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Submit your pet's vaccination card for review. A vet on your care team — or an admin if
            you have none — will confirm and add the verified badge to your pet's profile.
          </p>

          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : pending ? (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 flex items-start gap-2">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                <div className="font-medium">Pending review</div>
                <div className="text-xs text-muted-foreground">
                  Submitted {format(new Date(pending.submitted_at), "d MMM yyyy")}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Photos of vaccination card
                </Label>
                <PhotoUploadField value={photos} onChange={setPhotos} />
              </div>
              <Button onClick={submit} disabled={submitting} size="lg" className="w-full rounded-xl">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit for verification"}
              </Button>
            </>
          )}

          {requests.filter((r) => r.status !== "pending").length > 0 && (
            <div className="space-y-2 pt-2 border-t border-hairline">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">History</div>
              {requests
                .filter((r) => r.status !== "pending")
                .slice(0, 3)
                .map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {r.status === "approved" ? (
                        <ShieldCheck className="h-3.5 w-3.5 text-leaf" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                      )}
                      <Badge variant="outline" className="text-[10px] capitalize">{r.status}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(r.reviewed_at ?? r.submitted_at), "d MMM yyyy")}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}