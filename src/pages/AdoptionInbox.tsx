import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, X, HandHeart, MapPin, Phone, Home as HomeIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useSeo } from "@/hooks/useSeo";

const AdoptionInbox = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  useSeo({ title: "Adoption inbox", noIndex: true });

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

  const decide = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase
      .from("adoption_applications")
      .update({ status, decided_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Approved" : "Declined");
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

              {a.status === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => decide(a.id, "approved")} className="flex-1 rounded-xl gap-1.5">
                    <Check className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => decide(a.id, "rejected")} className="flex-1 rounded-xl gap-1.5">
                    <X className="h-3.5 w-3.5" /> Decline
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdoptionInbox;