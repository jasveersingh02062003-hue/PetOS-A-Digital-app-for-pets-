import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ShieldCheck, X, Check } from "lucide-react";
import { toast } from "sonner";

const AccessRequests = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["my-access-requests", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pet_access_requests" as any)
        .select("*, pets(name, species, avatar_url)")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });

  const respond = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase
      .from("pet_access_requests" as any)
      .update({ status })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Access granted" : "Request rejected");
    qc.invalidateQueries({ queryKey: ["my-access-requests"] });
  };

  return (
    <div className="container-app pad-top-safe pb-24">
      <header className="pt-4 pb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-xl">Vet access requests</h1>
      </header>

      {(data?.length ?? 0) === 0 && (
        <Card className="rounded-2xl border-hairline p-6 text-center text-sm text-muted-foreground">
          No requests yet.
        </Card>
      )}

      <div className="space-y-3">
        {data?.map((r) => (
          <Card key={r.id} className="rounded-2xl border-hairline p-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary-soft overflow-hidden flex items-center justify-center">
                {r.pets?.avatar_url ? (
                  <img src={r.pets.avatar_url} alt={r.pets.name} className="h-full w-full object-cover" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-base">{r.pets?.name}</div>
                <div className="text-xs text-muted-foreground">
                  {r.pets?.species} · status: <span className="capitalize">{r.status}</span>
                </div>
              </div>
            </div>
            {r.message && <p className="text-sm mt-3 text-muted-foreground">{r.message}</p>}
            {r.status === "pending" && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-hairline">
                <Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => respond(r.id, "rejected")}>
                  <X className="h-4 w-4 mr-1" /> Reject
                </Button>
                <Button size="sm" className="flex-1 rounded-full" onClick={() => respond(r.id, "approved")}>
                  <Check className="h-4 w-4 mr-1" /> Approve
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AccessRequests;
