import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pill, ShoppingBag, Check, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Props = { petId: string };

const STATUS_TONE: Record<string, string> = {
  pending: "bg-primary-soft text-primary border-0",
  ordered: "bg-amber-500/15 text-amber-700 border-0",
  filled: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0",
  dismissed: "bg-muted text-muted-foreground border-0",
};

export const PharmacySuggestionsCard = ({ petId }: Props) => {
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ["pharmacy-suggestions", petId, user?.id],
    enabled: !!user && !!petId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacy_suggestions" as any)
        .select("id, med_name, dose, frequency, duration, notes, status, created_at, vet_id")
        .eq("pet_id", petId)
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "ordered" | "dismissed" | "pending" | "filled" }) => {
      const { error } = await supabase
        .from("pharmacy_suggestions" as any)
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["pharmacy-suggestions", petId, user?.id] });
      if (vars.status === "filled") toast.success("Marked as filled — your vet will see this.");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not update"),
  });

  if (isLoading) {
    return (
      <Card className="rounded-2xl border-hairline p-4 mb-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading prescriptions…
      </Card>
    );
  }

  if (!items || items.length === 0) return null;

  return (
    <Card className="rounded-2xl border-hairline p-4 mb-3 space-y-3">
      <div className="flex items-center gap-2">
        <Pill className="h-4 w-4 text-primary" />
        <div className="font-medium text-sm">Vet prescriptions</div>
        <Badge variant="secondary" className="ml-auto bg-muted text-foreground">
          {items.length}
        </Badge>
      </div>

      <ul className="space-y-2">
        {items.map((rx) => {
          const detail = [rx.dose, rx.frequency, rx.duration].filter(Boolean).join(" · ");
          const shopUrl = `/shop?cat=health&q=${encodeURIComponent(rx.med_name)}`;
          return (
            <li key={rx.id} className="rounded-xl bg-muted/40 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm">{rx.med_name}</div>
                  {detail && (
                    <div className="text-xs text-muted-foreground">{detail}</div>
                  )}
                  {rx.notes && (
                    <div className="text-xs text-muted-foreground italic mt-1">
                      "{rx.notes}"
                    </div>
                  )}
                </div>
                <Badge className={STATUS_TONE[rx.status] ?? STATUS_TONE.pending}>
                  {rx.status ?? "pending"}
                </Badge>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="rounded-full h-8 text-xs flex-1"
                  onClick={() => {
                    if (rx.status !== "ordered") {
                      setStatus.mutate({ id: rx.id, status: "ordered" });
                    }
                    nav(shopUrl);
                  }}
                >
                  <ShoppingBag className="h-3.5 w-3.5 mr-1" />
                  {rx.status === "ordered" ? "View in shop" : "Find in shop"}
                </Button>
                {rx.status !== "filled" && rx.status !== "dismissed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full h-8 text-xs"
                    onClick={() => setStatus.mutate({ id: rx.id, status: "filled" })}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark filled
                  </Button>
                )}
                {rx.status !== "dismissed" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full h-8 text-xs"
                    onClick={() => setStatus.mutate({ id: rx.id, status: "dismissed" })}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" /> Dismiss
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
};