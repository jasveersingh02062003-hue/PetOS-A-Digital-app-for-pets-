import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Syringe, Pill, Bug, Activity, Utensils, FileText, Heart, Stethoscope } from "lucide-react";
import { format } from "date-fns";

type Item = {
  id: string;
  date: Date;
  kind: string;
  title: string;
  detail?: string;
  icon: any;
};

const ICONS: Record<string, any> = {
  vaccination: Syringe,
  medication: Pill,
  parasite: Bug,
  vital: Heart,
  symptom: Activity,
  nutrition: Utensils,
  record: FileText,
  consult: Stethoscope,
};

const Timeline = () => {
  const { petId } = useParams();
  const nav = useNavigate();

  const { data: pet } = useQuery({
    queryKey: ["pet-min", petId],
    queryFn: async () => {
      const { data } = await supabase.from("pets").select("name, public_id, species, breed").eq("id", petId!).maybeSingle();
      return data;
    },
    enabled: !!petId,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["timeline", petId],
    queryFn: async () => {
      const [vax, meds, paras, vitals, symptoms, nutrition, records, consults] = await Promise.all([
        supabase.from("vaccinations").select("id, vaccine_name, administered_on, vet_name").eq("pet_id", petId!).order("administered_on", { ascending: false }).limit(50),
        supabase.from("medication_logs").select("id, name, dose, frequency, start_on, active").eq("pet_id", petId!).order("start_on", { ascending: false }).limit(50),
        supabase.from("parasite_preventatives").select("id, product_name, parasite_type, given_on").eq("pet_id", petId!).order("given_on", { ascending: false }).limit(50),
        supabase.from("vital_logs").select("id, weight_kg, temperature_c, recorded_at, notes").eq("pet_id", petId!).order("recorded_at", { ascending: false }).limit(50),
        supabase.from("symptom_logs").select("id, symptom, severity, logged_at, notes").eq("pet_id", petId!).order("logged_at", { ascending: false }).limit(50),
        supabase.from("nutrition_logs").select("id, food, portion, fed_at").eq("pet_id", petId!).order("fed_at", { ascending: false }).limit(20),
        supabase.from("health_records").select("id, title, record_type, occurred_on, notes").eq("pet_id", petId!).order("occurred_on", { ascending: false }).limit(50),
        supabase.from("vet_consults").select("id, severity, status, ai_summary, created_at").eq("pet_id", petId!).order("created_at", { ascending: false }).limit(20),
      ]);
      const items: Item[] = [];
      vax.data?.forEach((v: any) => items.push({ id: `vax-${v.id}`, date: new Date(v.administered_on), kind: "vaccination", title: v.vaccine_name, detail: v.vet_name ? `by ${v.vet_name}` : undefined, icon: ICONS.vaccination }));
      meds.data?.forEach((m: any) => items.push({ id: `med-${m.id}`, date: new Date(m.start_on), kind: "medication", title: `${m.name}${m.active ? " (active)" : ""}`, detail: [m.dose, m.frequency].filter(Boolean).join(" · "), icon: ICONS.medication }));
      paras.data?.forEach((p: any) => items.push({ id: `par-${p.id}`, date: new Date(p.given_on), kind: "parasite", title: p.product_name, detail: p.parasite_type, icon: ICONS.parasite }));
      vitals.data?.forEach((v: any) => items.push({ id: `vit-${v.id}`, date: new Date(v.recorded_at), kind: "vital", title: "Vitals", detail: [v.weight_kg && `${v.weight_kg} kg`, v.temperature_c && `${v.temperature_c}°C`, v.notes].filter(Boolean).join(" · "), icon: ICONS.vital }));
      symptoms.data?.forEach((s: any) => items.push({ id: `sym-${s.id}`, date: new Date(s.logged_at), kind: "symptom", title: s.symptom, detail: `Severity ${s.severity}/5`, icon: ICONS.symptom }));
      nutrition.data?.forEach((n: any) => items.push({ id: `nut-${n.id}`, date: new Date(n.fed_at), kind: "nutrition", title: n.food, detail: n.portion, icon: ICONS.nutrition }));
      records.data?.forEach((r: any) => items.push({ id: `rec-${r.id}`, date: new Date(r.occurred_on), kind: "record", title: r.title, detail: r.record_type, icon: ICONS.record }));
      consults.data?.forEach((c: any) => items.push({ id: `con-${c.id}`, date: new Date(c.created_at), kind: "consult", title: `Vet consult (${c.severity})`, detail: c.ai_summary?.slice(0, 80), icon: ICONS.consult }));
      items.sort((a, b) => b.date.getTime() - a.date.getTime());
      return items;
    },
    enabled: !!petId,
  });

  return (
    <div className="container-app pad-top-safe pb-24">
      <header className="pt-4 pb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="font-display text-2xl">Timeline</h1>
          {pet && <p className="text-xs text-muted-foreground">{pet.name} · {pet.public_id}</p>}
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Card key={i} className="rounded-2xl border-hairline bg-card shadow-none p-4 h-16 animate-pulse" />)}</div>
      ) : !data?.length ? (
        <Card className="rounded-2xl border-hairline bg-card shadow-none p-8 text-center text-sm text-muted-foreground">
          Nothing logged yet — add vitals, vaccinations or symptoms to start the timeline.
        </Card>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-2 top-2 bottom-2 w-px bg-hairline" />
          {data.map((it) => {
            const Icon = it.icon;
            return (
              <div key={it.id} className="relative mb-4">
                <div className="absolute -left-[18px] top-3 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                <Card className="rounded-2xl border-hairline bg-card shadow-none p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{it.title}</span>
                        <Badge variant="outline" className="text-[10px] border-hairline capitalize">{it.kind}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{format(it.date, "d MMM yyyy · h:mm a")}</div>
                      {it.detail && <p className="text-sm text-ink-soft mt-1">{it.detail}</p>}
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Timeline;
