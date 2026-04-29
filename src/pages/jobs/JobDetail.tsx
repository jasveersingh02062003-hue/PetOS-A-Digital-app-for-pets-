import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useSeo } from "@/hooks/useSeo";
import { getCategoryMeta } from "@/lib/serviceCategories";

const JobDetail = () => {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { id = "" } = useParams();
  const { user } = useAuth();
  useSeo({ title: "Job", description: "Pet-care job details." });

  const [msg, setMsg] = useState("");
  const [price, setPrice] = useState("");

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", id],
    queryFn: async () => {
      const { data } = await (supabase.from("job_posts" as any) as any).select("*").eq("id", id).maybeSingle();
      return data as any;
    },
  });

  const { data: provider } = useQuery({
    queryKey: ["my-provider-min", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("service_providers")
        .select("id, owner_id, category, verification_status")
        .eq("owner_id", user!.id)
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  const isOwner = job && user && job.owner_id === user.id;
  const canOffer = !!provider
    && !!job
    && job.status === "open"
    && provider.category === job.category
    && provider.verification_status === "approved"
    && !isOwner;

  const { data: offers } = useQuery({
    queryKey: ["job-offers", id],
    enabled: !!job,
    queryFn: async () => {
      const { data } = await (supabase.from("job_offers" as any) as any)
        .select("id, message, price_inr, status, provider_id, provider_owner_id, created_at")
        .eq("job_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const sendOffer = useMutation({
    mutationFn: async () => {
      if (!provider || !user) throw new Error("Provider profile required");
      const { error } = await (supabase.from("job_offers" as any) as any).insert({
        job_id: id,
        provider_id: provider.id,
        provider_owner_id: user.id,
        message: msg || null,
        price_inr: price ? parseInt(price) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Offer sent");
      setMsg(""); setPrice("");
      qc.invalidateQueries({ queryKey: ["job-offers", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not send"),
  });

  const accept = useMutation({
    mutationFn: async (offer: any) => {
      const { error } = await (supabase.from("job_posts" as any) as any)
        .update({ status: "assigned", assigned_provider_id: offer.provider_id })
        .eq("id", id);
      if (error) throw error;
      const { error: e2 } = await (supabase.from("job_offers" as any) as any)
        .update({ status: "accepted" })
        .eq("id", offer.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Offer accepted");
      qc.invalidateQueries({ queryKey: ["job", id] });
      qc.invalidateQueries({ queryKey: ["job-offers", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not accept"),
  });

  const cancel = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("job_posts" as any) as any).update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cancelled"); qc.invalidateQueries({ queryKey: ["job", id] }); },
    onError: (e: any) => toast.error(e?.message ?? "Could not cancel"),
  });

  if (isLoading) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!job) return <div className="container-app pt-4">Not found.</div>;

  return (
    <div className="container-app pt-4 pb-24 max-w-lg">
      <header className="flex items-center gap-2 mb-3">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="font-display text-xl flex-1 truncate">{job.title}</h1>
        <Badge variant="outline" className="text-[10px]">{job.status}</Badge>
      </header>

      <Card className="rounded-2xl border-hairline p-4 mb-3 space-y-1.5">
        <div className="text-sm">{getCategoryMeta(job.category)?.label}</div>
        <div className="text-xs text-muted-foreground">{new Date(job.scheduled_at).toLocaleString()} · {job.duration_minutes} min</div>
        {job.address && <div className="text-xs text-muted-foreground">{job.address}</div>}
        {job.budget_inr && <div className="text-sm">Budget ₹{job.budget_inr}</div>}
        {job.description && <p className="text-sm pt-2">{job.description}</p>}
      </Card>

      {isOwner && job.status === "open" && (
        <Button variant="outline" className="w-full mb-3" onClick={() => cancel.mutate()}>Cancel job</Button>
      )}

      {/* Offer form for providers */}
      {canOffer && (
        <Card className="rounded-2xl border-hairline p-4 mb-3 space-y-2">
          <h2 className="font-display text-sm">Send an offer</h2>
          <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Your price (₹)" />
          <Textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Short message to the owner" />
          <Button className="w-full" onClick={() => sendOffer.mutate()} disabled={sendOffer.isPending}>
            {sendOffer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send offer"}
          </Button>
        </Card>
      )}

      {/* Offers list (visible to owner + each provider on their own) */}
      <h2 className="font-display text-sm mb-2">Offers</h2>
      {(offers?.length ?? 0) === 0 ? (
        <div className="text-xs text-muted-foreground">No offers yet.</div>
      ) : (
        <div className="space-y-2">
          {offers!.map((o: any) => (
            <Card key={o.id} className="rounded-xl border-hairline p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm">{o.price_inr ? `₹${o.price_inr}` : "—"}</div>
                <Badge variant="outline" className="text-[10px]">{o.status}</Badge>
              </div>
              {o.message && <p className="text-xs text-muted-foreground mt-1">{o.message}</p>}
              {isOwner && job.status === "open" && o.status === "pending" && (
                <Button size="sm" className="mt-2" onClick={() => accept.mutate(o)} disabled={accept.isPending}>
                  <Check className="h-4 w-4 mr-1" /> Accept
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default JobDetail;