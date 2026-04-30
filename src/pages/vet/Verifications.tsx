import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ShieldCheck, Loader2, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PhotoThumbs } from "@/components/health/PhotoUploadField";

const VetVerifications = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: isVet } = useQuery({
    queryKey: ["is-vet-vrf", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role")
        .eq("user_id", user!.id).in("role", ["vet", "super_admin"]);
      return (data?.length ?? 0) > 0;
    },
  });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["vet-verify-queue"],
    enabled: !!isVet,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vaccination_verification_requests" as any)
        .select("*, pets(id, name, species, breed, avatar_url, public_id, owner_id)")
        .eq("status", "pending")
        .order("submitted_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  if (!isVet) {
    return (
      <div className="container-app pad-top-safe pt-6">
        <p className="text-sm text-muted-foreground">Vet access required.</p>
      </div>
    );
  }

  return (
    <div className="container-app pad-top-safe pb-24">
      <header className="pt-4 pb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> Verification queue
        </h1>
      </header>

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : requests.length === 0 ? (
        <Card className="rounded-2xl border-hairline p-8 text-center text-sm text-muted-foreground">
          Nothing waiting. Pending requests from pets on your care team appear here.
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <ReviewCard key={r.id} req={r} onDone={() => qc.invalidateQueries({ queryKey: ["vet-verify-queue"] })} />
          ))}
        </div>
      )}
    </div>
  );
};

function ReviewCard({ req, onDone }: { req: any; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  const decide = async (status: "approved" | "rejected") => {
    setBusy(status === "approved" ? "approve" : "reject");
    const { error } = await supabase
      .from("vaccination_verification_requests" as any)
      .update({ status, reviewer_note: note.trim() || null })
      .eq("id", req.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Approved" : "Rejected");
    onDone();
  };

  return (
    <Card className="rounded-2xl border-hairline p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-primary-soft overflow-hidden grid place-items-center">
          {req.pets?.avatar_url ? (
            <img src={req.pets.avatar_url} alt={req.pets.name} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-4 w-4 text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-base">{req.pets?.name}</div>
          <div className="text-xs text-muted-foreground">
            {req.pets?.species} · {req.pets?.public_id} · submitted {format(new Date(req.submitted_at), "d MMM")}
          </div>
        </div>
      </div>

      <PhotoThumbs paths={req.photo_paths} />

      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note for the owner…"
        className="rounded-xl border-hairline min-h-[60px]"
      />

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1 rounded-full"
          disabled={!!busy}
          onClick={() => decide("rejected")}
        >
          {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject"}
        </Button>
        <Button className="flex-1 rounded-full" disabled={!!busy} onClick={() => decide("approved")}>
          {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
        </Button>
      </div>
    </Card>
  );
}

export default VetVerifications;