import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, X, HandHeart, MapPin, Phone, Home as HomeIcon, History, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { toast } from "sonner";
import { useSeo } from "@/hooks/useSeo";

const AdoptionInbox = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  useSeo({ title: "Adoption inbox", noIndex: true });

  const [pending, setPending] = useState<{ id: string; status: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);

  const { data: apps, isLoading } = useQuery({
    queryKey: ["adoption-inbox", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("adoption_applications")
        .select("*")
        .eq("shelter_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Realtime: any change to applications addressed to this shelter repaints the list
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`adoption-inbox:${user.id}`)
      .on("postgres_changes" as any,
        { event: "*", schema: "public", table: "adoption_applications", filter: `shelter_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["adoption-inbox", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const openDecision = (id: string, status: "approved" | "rejected") => {
    setNote("");
    setPending({ id, status });
  };

  const confirmDecision = async () => {
    if (!pending) return;
    setBusy(true);
    const { error } = await supabase
      .from("adoption_applications")
      .update({
        status: pending.status,
        decided_at: new Date().toISOString(),
        shelter_note: note.trim() || null,
      })
      .eq("id", pending.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      pending.status === "approved" ? "Approved — applicant notified" : "Declined — applicant notified",
    );
    setPending(null);
    qc.invalidateQueries({ queryKey: ["adoption-inbox", user!.id] });
  };

  if (!user)
    return <div className="container-app pt-10 text-center text-muted-foreground">Sign in to view applications.</div>;

  return (
    <div className="container-app pt-4 pb-24 max-w-lg">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="font-display text-2xl mb-1">Adoption inbox</h1>
      <p className="text-sm text-muted-foreground mb-4">Review applications and volunteer interest.</p>

      {isLoading ? (
        <div className="text-center text-sm text-muted-foreground py-10">Loading…</div>
      ) : !apps?.length ? (
        <div className="text-center text-sm text-muted-foreground py-10">No applications yet.</div>
      ) : (
        <div className="space-y-3">
          {apps.map((a: any) => (
            <Card key={a.id} className="rounded-2xl border-hairline p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-[11px]">
                  {a.is_volunteer_interest ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-coral/10 text-coral">
                      <HandHeart className="h-3 w-3" /> Volunteer
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-leaf/10 text-leaf">
                      <HomeIcon className="h-3 w-3" /> Adopter
                    </span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded-full ${
                      a.status === "approved"
                        ? "bg-leaf/15 text-leaf"
                        : a.status === "rejected"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {format(new Date(a.created_at), "MMM d")}
                </span>
              </div>

              {a.home_description && (
                <p className="text-sm whitespace-pre-wrap mb-2">{a.home_description}</p>
              )}
              {a.prior_experience && (
                <p className="text-xs text-muted-foreground mb-2"><b>Experience:</b> {a.prior_experience}</p>
              )}
              <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground mb-3">
                {a.family_size && <span>Family: {a.family_size}</span>}
                {a.has_yard != null && <span>Yard: {a.has_yard ? "yes" : "no"}</span>}
                {a.other_pets && <span>Other pets: {a.other_pets}</span>}
                {a.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{a.city}</span>}
                {a.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{a.phone}</span>}
              </div>

              {a.status === "pending" ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => openDecision(a.id, "approved")} className="flex-1 rounded-xl gap-1.5">
                    <Check className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openDecision(a.id, "rejected")} className="flex-1 rounded-xl gap-1.5">
                    <X className="h-3.5 w-3.5" /> Decline
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  {a.shelter_note && (
                    <p className="text-[11px] text-muted-foreground italic line-clamp-2 flex-1">
                      Note: {a.shelter_note}
                    </p>
                  )}
                  <button
                    onClick={() => setHistoryId(a.id)}
                    className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <History className="h-3 w-3" /> History
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Decision dialog */}
      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.status === "approved" ? "Approve application" : "Decline application"}
            </DialogTitle>
            <DialogDescription>
              The applicant will be notified
              {pending?.status === "approved" ? " and can proceed with next steps." : "."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              pending?.status === "approved"
                ? "Optional message — meet-up address, paperwork details…"
                : "Optional reason — helps the applicant understand."
            }
            rows={4}
            className="rounded-xl"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={confirmDecision} disabled={busy} className="gap-1.5">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {pending?.status === "approved" ? "Confirm approve" : "Confirm decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <DecisionHistoryDialog
        applicationId={historyId}
        onClose={() => setHistoryId(null)}
      />
    </div>
  );
};

const DecisionHistoryDialog = ({
  applicationId,
  onClose,
}: {
  applicationId: string | null;
  onClose: () => void;
}) => {
  const { data, isLoading } = useQuery({
    queryKey: ["adoption-decisions", applicationId],
    enabled: !!applicationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adoption_application_decisions")
        .select("id, status, note, created_at, decided_by")
        .eq("application_id", applicationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Dialog open={!!applicationId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decision history</DialogTitle>
          <DialogDescription>Audit trail for this application.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="py-6 grid place-items-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No decisions recorded yet.</p>
        ) : (
          <ul className="space-y-3 max-h-80 overflow-y-auto">
            {data.map((d: any) => (
              <li key={d.id} className="rounded-xl border border-hairline p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      d.status === "approved"
                        ? "bg-leaf/15 text-leaf"
                        : d.status === "rejected"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {d.status}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {format(new Date(d.created_at), "MMM d, HH:mm")}
                  </span>
                </div>
                {d.note && <p className="text-xs whitespace-pre-wrap">{d.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AdoptionInbox;