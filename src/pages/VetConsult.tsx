import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Stethoscope, ShieldCheck, Clock, AlertTriangle, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, string> = {
  awaiting_vet: "Awaiting vet",
  assigned: "Vet assigned",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const sevTone = (s: string) =>
  s === "severe" ? "bg-emergency/10 text-emergency border-emergency/30"
  : s === "moderate" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
  : "bg-primary-soft text-primary border-primary/20";

const VetConsult = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data: consult, isLoading } = useQuery({
    queryKey: ["consult", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vet_consults")
        .select("*, pets:pet_id(name, breed, species, date_of_birth, vaccination_verified, avatar_url)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: vax } = useQuery({
    queryKey: ["consult-vax", consult?.pet_id],
    queryFn: async () => {
      const { data } = await supabase.from("vaccinations")
        .select("vaccine_name, administered_on, next_due_on")
        .eq("pet_id", consult!.pet_id).order("administered_on", { ascending: false }).limit(5);
      return data ?? [];
    },
    enabled: !!consult?.pet_id,
  });

  const { data: symp } = useQuery({
    queryKey: ["consult-symp", consult?.pet_id],
    queryFn: async () => {
      const { data } = await supabase.from("symptom_logs")
        .select("symptom, severity, logged_at")
        .eq("pet_id", consult!.pet_id).order("logged_at", { ascending: false }).limit(5);
      return data ?? [];
    },
    enabled: !!consult?.pet_id,
  });

  const cancel = async () => {
    if (!consult) return;
    const { error } = await supabase.from("vet_consults")
      .update({ status: "cancelled" })
      .eq("id", consult.id);
    if (error) return toast.error(error.message);
    toast.success("Consult cancelled");
    qc.invalidateQueries({ queryKey: ["consult", id] });
    qc.invalidateQueries({ queryKey: ["consults"] });
  };

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
  if (!consult) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="font-display text-xl">Consult not found</div>
      <Button variant="outline" onClick={() => nav("/health")}>Back to vault</Button>
    </div>
  );

  const pet = (consult as any).pets;
  const ageY = pet?.date_of_birth
    ? ((Date.now() - new Date(pet.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000)).toFixed(1)
    : null;
  const active = !["completed", "cancelled"].includes(consult.status);

  return (
    <div className="min-h-screen bg-background">
      <header className="container-app pad-top-safe pt-4 pb-3 flex items-center gap-3 border-b border-hairline">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="font-display text-lg leading-tight">Vet consult</div>
          <div className="text-xs text-muted-foreground">{format(new Date(consult.created_at), "d MMM, h:mm a")}</div>
        </div>
        <Badge variant="secondary" className="rounded-full">{STATUS_LABEL[consult.status]}</Badge>
      </header>

      <div className="container-app py-5 space-y-4">
        {/* Severity banner */}
        <div className={`rounded-2xl border p-4 ${sevTone(consult.severity)}`}>
          <div className="flex items-center gap-2 font-display text-lg capitalize">
            <AlertTriangle className="h-5 w-5" /> {consult.severity} severity
          </div>
          {consult.ai_summary && <p className="text-sm mt-2 leading-relaxed text-foreground/90">{consult.ai_summary}</p>}
        </div>

        {/* Pet card */}
        {pet && (
          <Card className="rounded-2xl border-hairline bg-card shadow-none p-4">
            <div className="flex items-center gap-3">
              {pet.avatar_url ? (
                <img src={pet.avatar_url} alt={pet.name} className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-primary-soft text-primary grid place-items-center font-display">
                  {pet.name?.[0] ?? "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-display text-lg">{pet.name}</div>
                  {pet.vaccination_verified && (
                    <Badge variant="secondary" className="bg-primary-soft text-primary border-0 gap-1 text-[10px]">
                      <ShieldCheck className="h-3 w-3" /> Verified
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[pet.breed, pet.species, ageY ? `${ageY} yrs` : null].filter(Boolean).join(" · ")}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Status placeholder */}
        {consult.status === "awaiting_vet" && (
          <Card className="rounded-2xl border-hairline bg-card shadow-none p-5 text-center">
            <Clock className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <div className="font-medium">Awaiting first available vet</div>
            <p className="text-sm text-muted-foreground mt-1">
              We'll notify you the moment a vet picks up. Average response under 10 min.
            </p>
          </Card>
        )}

        {consult.status === "completed" && consult.prescription && (
          <Card className="rounded-2xl border-hairline bg-card shadow-none p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Prescription</div>
            <p className="text-sm whitespace-pre-wrap">{consult.prescription}</p>
          </Card>
        )}

        {/* Vault snapshot */}
        <Card className="rounded-2xl border-hairline bg-card shadow-none p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Recent vaccinations</div>
          {vax?.length ? (
            <ul className="space-y-1.5 text-sm">
              {vax.map((v, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{v.vaccine_name}</span>
                  <span className="text-muted-foreground text-xs">{format(new Date(v.administered_on), "d MMM yyyy")}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">None on record</p>}
        </Card>

        <Card className="rounded-2xl border-hairline bg-card shadow-none p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Recent symptoms</div>
          {symp?.length ? (
            <ul className="space-y-1.5 text-sm">
              {symp.map((s, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{s.symptom} <span className="text-xs text-muted-foreground">· sev {s.severity}/5</span></span>
                  <span className="text-muted-foreground text-xs">{format(new Date(s.logged_at), "d MMM")}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">None logged</p>}
        </Card>

        {active && (
          <Button variant="outline" onClick={cancel} className="w-full rounded-2xl h-12 gap-2 border-hairline">
            <X className="h-4 w-4" /> Cancel consult
          </Button>
        )}
        <Button variant="ghost" onClick={() => nav("/ai")} className="w-full gap-2">
          <Stethoscope className="h-4 w-4" /> Talk to AI assistant meanwhile
        </Button>
      </div>
    </div>
  );
};

export default VetConsult;
