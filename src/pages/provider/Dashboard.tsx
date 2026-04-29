import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Briefcase, ListChecks, Loader2, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useSeo } from "@/hooks/useSeo";
import { getCategoryMeta } from "@/lib/serviceCategories";

const ProviderDashboard = () => {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  useSeo({ title: "Provider dashboard", description: "Manage your services, jobs and bookings." });

  const { data: providers, isLoading } = useQuery({
    queryKey: ["my-providers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_providers")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const primary: any = providers?.[0];

  const { data: nearbyJobs } = useQuery({
    queryKey: ["nearby-jobs", primary?.category, primary?.id],
    enabled: !!primary,
    queryFn: async () => {
      const { data } = await (supabase.from("job_posts" as any) as any)
        .select("id, title, scheduled_at, address, budget_inr, category")
        .eq("status", "open")
        .eq("category", primary.category)
        .order("scheduled_at", { ascending: true })
        .limit(20);
      return data ?? [];
    },
  });

  const { data: todayBookings } = useQuery({
    queryKey: ["today-bookings", primary?.id],
    enabled: !!primary,
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today.getTime() + 24 * 3600_000);
      const { data } = await supabase
        .from("service_bookings")
        .select("id, status, scheduled_at, customer_id")
        .eq("provider_id", primary.id)
        .gte("scheduled_at", today.toISOString())
        .lt("scheduled_at", tomorrow.toISOString())
        .order("scheduled_at", { ascending: true });
      return data ?? [];
    },
  });

  const toggleOnDuty = useMutation({
    mutationFn: async (val: boolean) => {
      if (!primary) return;
      const { error } = await supabase
        .from("service_providers")
        .update({ accepting_jobs: val } as any)
        .eq("id", primary.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-providers"] });
      toast.success("Status updated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update"),
  });

  if (isLoading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  if (!primary) {
    return (
      <div className="container-app pt-4 pb-24 max-w-lg">
        <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="font-display text-2xl mb-2">Become a provider</h1>
        <p className="text-sm text-muted-foreground mb-4">Set up your service to start receiving booking requests and nearby jobs.</p>
        <Button onClick={() => nav("/onboarding/provider")} className="rounded-full h-12">
          <Plus className="h-4 w-4 mr-1" /> Get started
        </Button>
      </div>
    );
  }

  const cat = getCategoryMeta(primary.category);
  const status = primary.verification_status as "pending" | "approved" | "rejected";

  return (
    <div className="container-app pt-4 pb-24 max-w-lg">
      <header className="flex items-center gap-2 mb-3">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="font-display text-xl leading-tight">{primary.name}</h1>
          <div className="text-[11px] text-muted-foreground">{cat?.label} · {primary.city || "—"}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => nav("/services/manage")}><Settings2 className="h-5 w-5" /></Button>
      </header>

      {/* Verification banner */}
      {status !== "approved" && (
        <Card className={`rounded-2xl p-3 mb-3 border ${status === "rejected" ? "border-destructive/30 bg-destructive/5" : "border-amber/30 bg-amber/5"}`}>
          <div className="text-sm font-medium">
            {status === "pending" ? "Verification pending" : "Verification needs attention"}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {status === "pending"
              ? "Our team is reviewing your documents. You can prepare your profile in the meantime."
              : (primary.verification_notes || "Please re-submit your documents.")}
          </div>
        </Card>
      )}

      {/* On-duty toggle */}
      <Card className="rounded-2xl border-hairline p-4 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">On-duty</div>
            <div className="text-xs text-muted-foreground">Receive nearby job alerts</div>
          </div>
          <Switch
            checked={!!primary.accepting_jobs}
            disabled={status !== "approved" || toggleOnDuty.isPending}
            onCheckedChange={(v) => toggleOnDuty.mutate(v)}
          />
        </div>
      </Card>

      {/* Today's schedule */}
      <Card className="rounded-2xl border-hairline p-4 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm">Today's schedule</h2>
        </div>
        {(todayBookings?.length ?? 0) === 0 ? (
          <div className="text-xs text-muted-foreground">No bookings today.</div>
        ) : (
          <div className="space-y-2">
            {todayBookings!.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between text-sm">
                <div>{new Date(b.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                <Badge variant="outline" className="text-[10px]">{b.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Nearby jobs */}
      <Card className="rounded-2xl border-hairline p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm">Nearby jobs</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => nav("/jobs")}>View all</Button>
        </div>
        {(nearbyJobs?.length ?? 0) === 0 ? (
          <div className="text-xs text-muted-foreground">No open jobs in your category right now.</div>
        ) : (
          <div className="space-y-2">
            {nearbyJobs!.slice(0, 5).map((j: any) => (
              <button key={j.id} onClick={() => nav(`/jobs/${j.id}`)}
                className="w-full text-left rounded-xl border border-hairline p-3 hover:border-foreground/20">
                <div className="text-sm font-medium truncate">{j.title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {new Date(j.scheduled_at).toLocaleString()}{j.budget_inr ? ` · ₹${j.budget_inr}` : ""}
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ProviderDashboard;