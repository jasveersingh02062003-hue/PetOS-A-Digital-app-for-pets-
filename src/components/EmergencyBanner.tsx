import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePets, useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Siren, PhoneCall, Stethoscope, X } from "lucide-react";
import { toast } from "sonner";

/**
 * Global emergency banner — shows on every screen when an unresolved
 * AI-flagged emergency symptom is < 24h old for any of the user's pets.
 */
export const EmergencyBanner = () => {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: pets } = usePets();
  const { data: profile } = useProfile();
  const petIds = (pets ?? []).map((p) => p.id);
  const emergencyVet = (profile as any)?.emergency_vet ?? null;
  const vetPhone: string | undefined = emergencyVet?.phone?.trim() || undefined;
  const vetLabel = emergencyVet?.name || emergencyVet?.clinic || "vet";

  const { data: live } = useQuery({
    queryKey: ["active-emergency", petIds.join(",")],
    enabled: petIds.length > 0,
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { data, error } = await supabase
        .from("symptom_logs")
        .select("id, pet_id, symptom, ai_reason, logged_at")
        .in("pet_id", petIds)
        .eq("ai_flag", "emergency")
        .is("resolved_at", null)
        .gte("logged_at", since)
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error && (error as any).code !== "PGRST116") throw error;
      return data;
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (petIds.length === 0) return;
    const ch = supabase
      .channel("emergency-watch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "symptom_logs" },
        () => qc.invalidateQueries({ queryKey: ["active-emergency"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [petIds.join(","), qc]);

  if (!live) return null;

  const petName = pets?.find((p) => p.id === (live as any).pet_id)?.name ?? "your pet";

  const resolve = async () => {
    const { error } = await supabase
      .from("symptom_logs")
      .update({ resolved_at: new Date().toISOString() } as any)
      .eq("id", (live as any).id);
    if (error) return toast.error(error.message);
    toast.success("Marked resolved");
    qc.invalidateQueries({ queryKey: ["active-emergency"] });
  };

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 bg-destructive text-destructive-foreground shadow-lg animate-in slide-in-from-top duration-300"
    >
      <div className="container-app py-3 flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-destructive-foreground/15 grid place-items-center shrink-0">
          <Siren className="h-4.5 w-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm leading-tight">
            Possible emergency — {petName}
          </div>
          <div className="text-xs opacity-90 mt-0.5 line-clamp-2">
            {(live as any).symptom}
            {(live as any).ai_reason ? ` · ${(live as any).ai_reason}` : ""}
          </div>
          <div className="flex flex-wrap gap-2 mt-2.5">
            {vetPhone ? (
              <Button asChild size="sm" variant="secondary" className="rounded-full h-8 gap-1.5">
                <a href={`tel:${vetPhone}`}>
                  <PhoneCall className="h-3.5 w-3.5" /> Call {vetLabel}
                </a>
              </Button>
            ) : (
              <Button asChild size="sm" variant="secondary" className="rounded-full h-8 gap-1.5">
                <a href="/settings/emergency-vet">
                  <PhoneCall className="h-3.5 w-3.5" /> Add emergency vet
                </a>
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              className="rounded-full h-8 gap-1.5"
              onClick={() => nav("/askvet/new")}
            >
              <Stethoscope className="h-3.5 w-3.5" /> Ask vet now
            </Button>
            <button
              onClick={resolve}
              className="text-xs underline opacity-90 hover:opacity-100 px-2"
            >
              Mark resolved
            </button>
          </div>
        </div>
        <button
          onClick={resolve}
          aria-label="Dismiss"
          className="opacity-70 hover:opacity-100 -mr-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
