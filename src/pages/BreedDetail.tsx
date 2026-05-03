import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, IndianRupee, Heart, AlertTriangle, Activity, Stethoscope, Shield, Eye, Loader2 } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";

export default function BreedDetail() {
  const { species, breed } = useParams();
  const nav = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["breed-detail", species, breed],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("breed_profiles")
        .select("*")
        .eq("species", species!)
        .eq("breed", decodeURIComponent(breed!))
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useSeo({
    title: data ? `${data.breed} — care, cost, climate fit (India)` : "Breed details",
    description: data?.short_summary,
  });

  if (isLoading) return <div className="container-app pad-top-safe pt-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!data) return <div className="container-app pad-top-safe pt-10 text-sm text-muted-foreground">Breed not found.</div>;

  return (
    <div className="container-app pad-top-safe pb-16">
      <header className="pt-6 pb-4">
        <button onClick={() => nav(-1)} className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-3">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{data.species}</div>
        <h1 className="font-display text-[28px] mt-1 leading-tight">{data.breed}</h1>
        {data.origin && <p className="text-sm text-muted-foreground mt-1">Origin: {data.origin}</p>}
      </header>

      {data.short_summary && (
        <Card className="p-4 rounded-2xl border-hairline mb-4 bg-gradient-to-br from-primary/5 to-coral/5">
          <p className="text-sm">{data.short_summary}</p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2 mb-5">
        <Stat icon={IndianRupee} label="Monthly cost" value={data.monthly_cost_min ? `₹${data.monthly_cost_min.toLocaleString()}–${data.monthly_cost_max?.toLocaleString()}` : "—"} />
        <Stat icon={Activity} label="Exercise" value={data.exercise_hours_per_day ? `${data.exercise_hours_per_day} hr/day` : "—"} />
        <Stat icon={Heart} label="Lifespan" value={data.lifespan_years_min ? `${data.lifespan_years_min}–${data.lifespan_years_max} years` : "—"} />
        <Stat icon={Shield} label="Experience" value={data.experience_level ?? "—"} />
      </div>

      {data.climate_warnings && (
        <Section icon={AlertTriangle} title="Climate warning" tone="amber">
          <p className="text-sm">{data.climate_warnings}</p>
        </Section>
      )}

      {data.india_notes && (
        <Section icon={Heart} title="India notes" tone="primary">
          <p className="text-sm">{data.india_notes}</p>
        </Section>
      )}

      {data.temperament?.length > 0 && (
        <Section icon={Heart} title="Temperament">
          <div className="flex flex-wrap gap-1.5">
            {data.temperament.map((t: string) => (
              <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-muted">{t}</span>
            ))}
          </div>
        </Section>
      )}

      {data.common_health_issues?.length > 0 && (
        <Section icon={Stethoscope} title="Common health issues">
          <ul className="space-y-1 text-sm">
            {data.common_health_issues.map((c: string) => (<li key={c}>• {c}</li>))}
          </ul>
        </Section>
      )}

      {data.pure_breed_traits && (
        <Section icon={Eye} title="How to spot a pure breed">
          <p className="text-sm">{data.pure_breed_traits}</p>
        </Section>
      )}

      {data.fake_breeder_warnings && (
        <Section icon={AlertTriangle} title="Avoid fake breeders" tone="amber">
          <p className="text-sm">{data.fake_breeder_warnings}</p>
        </Section>
      )}

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => nav(`/mates/adopt?species=${data.species}`)}>Adopt one</Button>
        <Button onClick={() => nav("/find-my-pet")}>Take quiz</Button>
      </div>
    </div>
  );
}

const Stat = ({ icon: Icon, label, value }: any) => (
  <Card className="p-3 rounded-xl border-hairline">
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wide font-semibold mb-1">
      <Icon className="h-3 w-3" />{label}
    </div>
    <div className="text-sm font-medium">{value}</div>
  </Card>
);

const Section = ({ icon: Icon, title, children, tone = "default" }: any) => (
  <Card className={`p-4 rounded-2xl border-hairline mb-3 ${tone === "amber" ? "bg-amber/5" : tone === "primary" ? "bg-primary/5" : ""}`}>
    <div className="flex items-center gap-2 mb-2">
      <Icon className={`h-4 w-4 ${tone === "amber" ? "text-amber" : "text-primary"}`} />
      <div className="font-display text-sm">{title}</div>
    </div>
    {children}
  </Card>
);
