import { useState } from "react";
import { ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Props = { petId: string; verified: boolean };

export const PetVerifyBadge = ({ petId, verified }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const { data: req } = useQuery({
    queryKey: ["verify-req", petId],
    queryFn: async () => {
      const { data } = await supabase
        .from("verification_requests")
        .select("status")
        .eq("pet_id", petId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !verified && !!user,
  });

  if (verified) {
    return (
      <span className="text-[10px] rounded-full bg-primary/15 text-primary px-2 py-0.5 font-medium inline-flex items-center gap-1">
        <ShieldCheck className="h-3 w-3" /> Verified
      </span>
    );
  }

  if (req?.status === "pending") {
    return (
      <span className="text-[10px] rounded-full bg-muted text-muted-foreground px-2 py-0.5 font-medium">
        Pending review
      </span>
    );
  }

  const request = async () => {
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from("verification_requests").insert({
      pet_id: petId,
      owner_id: user.id,
      notes: "Owner-requested vaccination verification",
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Verification requested");
    qc.invalidateQueries({ queryKey: ["verify-req", petId] });
  };

  return (
    <Button
      size="sm"
      variant="outline"
      className="rounded-full h-7 text-xs px-2"
      onClick={request}
      disabled={submitting}
    >
      {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldAlert className="h-3 w-3 mr-1" />}
      Verify
    </Button>
  );
};
