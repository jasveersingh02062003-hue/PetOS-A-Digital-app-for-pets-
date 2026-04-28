import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Check, X } from "lucide-react";
import { SellerBadge } from "@/components/SellerBadge";
import { toast } from "sonner";
import { useSeo } from "@/hooks/useSeo";
import { useState } from "react";

const OrgReview = () => {
  const nav = useNavigate();
  const qc = useQueryClient();
  useSeo({ title: "Org review queue", description: "Review pending organisation applications." });

  const { data: pending, isLoading } = useQuery({
    queryKey: ["org-review-queue"],
    queryFn: async () => {
      const { data } = await supabase.from("org_profiles").select("*").eq("status", "pending").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ userId, status, reason }: { userId: string; status: "approved" | "rejected"; reason?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const patch: any = { status, reviewed_by: u.user?.id, reviewed_at: new Date().toISOString() };
      if (status === "rejected") patch.rejection_reason = reason ?? "Not eligible";
      const { error } = await supabase.from("org_profiles").update(patch).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-review-queue"] });
      toast.success("Updated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="container-app pt-4 pb-24 max-w-2xl">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="font-display text-2xl mb-4">Organisation review</h1>

      {isLoading ? (
        <div className="text-center text-muted-foreground">Loading…</div>
      ) : !pending?.length ? (
        <Card className="rounded-2xl border-hairline p-6 text-center text-muted-foreground">No pending applications</Card>
      ) : (
        <div className="space-y-3">
          {pending.map((o: any) => (
            <ReviewCard key={o.user_id} org={o} decide={decide.mutate} />
          ))}
        </div>
      )}
    </div>
  );
};

const ReviewCard = ({ org, decide }: { org: any; decide: any }) => {
  const [reason, setReason] = useState("");
  return (
    <Card className="rounded-2xl border-hairline p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-display text-lg">{org.org_name}</div>
          <div className="text-xs text-muted-foreground">{[org.city, org.state].filter(Boolean).join(", ")}</div>
        </div>
        <SellerBadge type={org.org_type} />
      </div>
      {org.registration_no && <div className="text-sm">Reg #: <span className="font-mono">{org.registration_no}</span></div>}
      {org.description && <p className="text-sm text-muted-foreground line-clamp-3">{org.description}</p>}
      <div className="flex flex-wrap gap-2 text-xs">
        {org.registration_doc_url && (
          <a href={org.registration_doc_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 underline text-sky">
            <FileText className="h-3 w-3" /> Document
          </a>
        )}
        {org.website && <a href={org.website} target="_blank" rel="noreferrer" className="underline">{org.website}</a>}
        {org.phone && <span>{org.phone}</span>}
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        <Button size="sm" onClick={() => decide({ userId: org.user_id, status: "approved" })} className="rounded-xl gap-1">
          <Check className="h-4 w-4" /> Approve
        </Button>
        <input
          placeholder="Reason for rejection"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="flex-1 min-w-[160px] h-9 px-3 rounded-xl border border-hairline bg-background text-sm"
        />
        <Button size="sm" variant="outline" onClick={() => decide({ userId: org.user_id, status: "rejected", reason })} className="rounded-xl gap-1">
          <X className="h-4 w-4" /> Reject
        </Button>
      </div>
    </Card>
  );
};

export default OrgReview;