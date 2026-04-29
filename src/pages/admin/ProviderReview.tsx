import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Check, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { useSeo } from "@/hooks/useSeo";

const ProviderReview = () => {
  const nav = useNavigate();
  const qc = useQueryClient();
  useSeo({ title: "Provider review", description: "Verify pending service providers." });

  const { data: pending, isLoading } = useQuery({
    queryKey: ["provider-review-queue"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_providers")
        .select("id, owner_id, name, category, city, verification_status, created_at")
        .eq("verification_status", "pending")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: "approved" | "rejected"; notes?: string }) => {
      const patch: any = { verification_status: status };
      if (status === "approved") patch.verified = true;
      if (status === "rejected") patch.verification_notes = notes ?? null;
      const { error } = await supabase.from("service_providers").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-review-queue"] });
      toast.success("Updated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="container-app pt-4 pb-24 max-w-2xl">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="font-display text-2xl mb-4">Provider verification</h1>
      {isLoading ? (
        <div className="text-center text-muted-foreground">Loading…</div>
      ) : !pending?.length ? (
        <Card className="rounded-2xl border-hairline p-6 text-center text-muted-foreground">No pending providers</Card>
      ) : (
        <div className="space-y-3">
          {pending.map((p: any) => <Row key={p.id} provider={p} decide={decide.mutate} />)}
        </div>
      )}
    </div>
  );
};

const Row = ({ provider, decide }: { provider: any; decide: any }) => {
  const [reason, setReason] = useState("");

  const { data: docs } = useQuery({
    queryKey: ["provider-docs", provider.id],
    queryFn: async () => {
      const { data } = await (supabase.from("provider_documents" as any) as any)
        .select("id, kind, file_path, status")
        .eq("provider_id", provider.id);
      return data ?? [];
    },
  });

  const sign = async (path: string) => {
    const { data } = await supabase.storage.from("provider-docs").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <Card className="rounded-2xl border-hairline p-4 space-y-3">
      <div>
        <div className="font-display text-base">{provider.name}</div>
        <div className="text-xs text-muted-foreground">{provider.category} · {provider.city || "—"}</div>
      </div>
      <div className="space-y-1">
        {(docs ?? []).map((d: any) => (
          <button key={d.id} onClick={() => sign(d.file_path)}
            className="w-full flex items-center gap-2 text-sm text-left rounded-lg border border-hairline px-3 py-2 hover:border-foreground/20">
            <FileText className="h-4 w-4 text-muted-foreground" /> {d.kind}
          </button>
        ))}
        {(docs?.length ?? 0) === 0 && <div className="text-xs text-muted-foreground">No documents uploaded.</div>}
      </div>
      <div className="flex flex-col gap-2">
        <Button size="sm" onClick={() => decide({ id: provider.id, status: "approved" })}>
          <Check className="h-4 w-4 mr-1" /> Approve
        </Button>
        <div className="flex gap-2">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="h-9" />
          <Button size="sm" variant="outline" onClick={() => decide({ id: provider.id, status: "rejected", notes: reason })}>
            <X className="h-4 w-4 mr-1" /> Reject
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default ProviderReview;