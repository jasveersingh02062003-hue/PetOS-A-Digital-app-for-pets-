import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Briefcase } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";
import { getCategoryMeta } from "@/lib/serviceCategories";

const JobsFeed = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  useSeo({ title: "Jobs", description: "Open pet-care jobs near you." });

  const { data: providerCat } = useQuery({
    queryKey: ["my-provider-cat", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("service_providers")
        .select("category")
        .eq("owner_id", user!.id)
        .limit(1)
        .maybeSingle();
      return (data as any)?.category as string | undefined;
    },
  });

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["jobs-open", providerCat ?? "all"],
    queryFn: async () => {
      const q = (supabase.from("job_posts" as any) as any)
        .select("id, title, category, scheduled_at, address, budget_inr, description")
        .eq("status", "open")
        .order("scheduled_at", { ascending: true })
        .limit(50);
      const { data } = providerCat ? await q.eq("category", providerCat) : await q;
      return data ?? [];
    },
  });

  const { data: myJobs } = useQuery({
    queryKey: ["my-jobs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase.from("job_posts" as any) as any)
        .select("id, title, status, scheduled_at, category")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  return (
    <div className="container-app pt-4 pb-24 max-w-lg">
      <header className="flex items-center gap-2 mb-3">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="font-display text-xl flex-1">Jobs</h1>
        <Button size="sm" onClick={() => nav("/jobs/new")}><Plus className="h-4 w-4 mr-1" /> Post</Button>
      </header>

      {(myJobs?.length ?? 0) > 0 && (
        <section className="mb-4">
          <h2 className="font-display text-sm mb-2">Your posts</h2>
          <div className="space-y-2">
            {myJobs!.map((j: any) => (
              <button key={j.id} onClick={() => nav(`/jobs/${j.id}`)}
                className="w-full text-left rounded-xl border border-hairline p-3 hover:border-foreground/20">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium truncate">{j.title}</div>
                  <Badge variant="outline" className="text-[10px]">{j.status}</Badge>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{new Date(j.scheduled_at).toLocaleString()}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      <h2 className="font-display text-sm mb-2 flex items-center gap-2">
        <Briefcase className="h-4 w-4" /> Open {providerCat ? `${getCategoryMeta(providerCat)?.label.toLowerCase() ?? ""} ` : ""}jobs
      </h2>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (jobs?.length ?? 0) === 0 ? (
        <Card className="rounded-2xl border-hairline p-6 text-center text-muted-foreground text-sm">No open jobs right now.</Card>
      ) : (
        <div className="space-y-2">
          {jobs!.map((j: any) => (
            <button key={j.id} onClick={() => nav(`/jobs/${j.id}`)}
              className="w-full text-left rounded-xl border border-hairline p-3 hover:border-foreground/20">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium truncate">{j.title}</div>
                {j.budget_inr ? <div className="text-xs">₹{j.budget_inr}</div> : null}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {new Date(j.scheduled_at).toLocaleString()} · {getCategoryMeta(j.category)?.label}
              </div>
              {j.address && <div className="text-[11px] text-muted-foreground truncate">{j.address}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default JobsFeed;