import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePets } from "@/hooks/useProfile";
import { useUnits } from "@/hooks/useUnits";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Heart, Syringe, Bug, Pill, Activity, ShieldCheck, Scale, Thermometer } from "lucide-react";
import { differenceInCalendarDays, differenceInYears, format } from "date-fns";

type Pet = { id: string; name: string; species?: string | null; breed?: string | null; date_of_birth?: string | null; avatar_url?: string | null; target_weight_kg?: number | null; vaccination_verified?: boolean | null; insurance_provider?: string | null };

const HealthCompare = () => {
  const nav = useNavigate();
  const { data: pets } = usePets();
  const [selected, setSelected] = useState<string[]>([]);

  // initialise to first 2 pets once loaded
  const initialised = useMemo(() => {
    if (selected.length === 0 && pets && pets.length >= 2) {
      return pets.slice(0, Math.min(3, pets.length)).map((p) => p.id);
    }
    return selected;
  }, [pets, selected]);

  const active = selected.length === 0 ? initialised : selected;

  const toggle = (id: string) => {
    if (active.includes(id)) {
      if (active.length <= 2) return; // keep at least 2
      setSelected(active.filter((x) => x !== id));
    } else {
      if (active.length >= 4) return; // cap at 4
      setSelected([...active, id]);
    }
  };

  return (
    <div className="container-app pad-top-safe">
      <header className="pt-6 pb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-full -ml-2" onClick={() => nav(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-2xl">Compare pets</h1>
          <p className="text-xs text-muted-foreground">Side-by-side health snapshot · pick 2 to 4 pets</p>
        </div>
      </header>

      {!pets || pets.length < 2 ? (
        <Card className="rounded-2xl border-hairline bg-card shadow-none p-8 text-center">
          <div className="font-display text-lg">Add a second pet first</div>
          <p className="text-sm text-muted-foreground mt-1">Compare needs at least two pets in your account.</p>
        </Card>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 mb-4">
            {pets.map((p) => {
              const on = active.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-card border-hairline"}`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>

          <div className="overflow-x-auto -mx-5 px-5 pb-6">
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: `repeat(${active.length}, minmax(220px, 1fr))` }}
            >
              {active.map((id) => {
                const pet = pets.find((p) => p.id === id);
                if (!pet) return null;
                return <PetColumn key={id} pet={pet as Pet} />;
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const PetColumn = ({ pet }: { pet: Pet }) => {
  const { formatWeight, kgToDisplay, weightUnit } = useUnits();

  const { data } = useQuery({
    queryKey: ["compare-pet", pet.id],
    queryFn: async () => {
      const [{ data: vital }, { data: vax }, { data: paras }, { data: meds }, { data: symp }, { data: weights }] = await Promise.all([
        supabase.from("vital_logs").select("recorded_at, weight_kg, temperature_c").eq("pet_id", pet.id).order("recorded_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("vaccinations").select("vaccine_name, administered_on, next_due_on").eq("pet_id", pet.id).order("administered_on", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("parasite_preventatives").select("product_name, next_due_on").eq("pet_id", pet.id).not("next_due_on", "is", null).order("next_due_on", { ascending: true }).limit(1).maybeSingle(),
        supabase.from("medication_logs").select("name").eq("pet_id", pet.id).eq("active", true),
        supabase.from("symptom_logs").select("id").eq("pet_id", pet.id).gte("logged_at", new Date(Date.now() - 7 * 86400_000).toISOString()),
        supabase.from("vital_logs").select("recorded_at, weight_kg").eq("pet_id", pet.id).not("weight_kg", "is", null).order("recorded_at", { ascending: true }).limit(20),
      ]);
      return { vital, vax, paras, meds: meds ?? [], symp: symp ?? [], weights: weights ?? [] };
    },
  });

  const ageYrs = pet.date_of_birth ? differenceInYears(new Date(), new Date(pet.date_of_birth)) : null;
  const lastWeightKg = data?.vital?.weight_kg ?? null;
  const targetKg = pet.target_weight_kg ?? null;
  const deltaKg = lastWeightKg && targetKg ? Number(lastWeightKg) - Number(targetKg) : null;

  const nextVaxDays = data?.vax?.next_due_on ? differenceInCalendarDays(new Date(data.vax.next_due_on), new Date()) : null;
  const nextParaDays = data?.paras?.next_due_on ? differenceInCalendarDays(new Date(data.paras.next_due_on), new Date()) : null;

  return (
    <Card className="rounded-2xl border-hairline bg-card shadow-none p-3 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="h-10 w-10 rounded-xl bg-muted overflow-hidden flex items-center justify-center text-sm font-semibold">
          {pet.avatar_url ? (
            <img src={pet.avatar_url} alt={pet.name} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            pet.name.slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <div className="font-display text-base truncate">{pet.name}</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {[pet.breed, pet.species].filter(Boolean).join(" · ")}
            {ageYrs !== null && ` · ${ageYrs}y`}
          </div>
        </div>
      </div>

      <Row icon={<Scale className="h-3.5 w-3.5" />} label="Weight">
        <div className="text-sm font-medium">{formatWeight(lastWeightKg)}</div>
        {deltaKg !== null && Math.abs(deltaKg) > 0.1 && (
          <div className={`text-[10px] ${deltaKg > 0 ? "text-rose-600" : "text-emerald-600"}`}>
            {deltaKg > 0 ? "+" : ""}{kgToDisplay(deltaKg)?.toFixed(1)} {weightUnit} vs target
          </div>
        )}
      </Row>

      <Row icon={<Thermometer className="h-3.5 w-3.5" />} label="Temp">
        <div className="text-sm">{data?.vital?.temperature_c ? `${data.vital.temperature_c}°C` : "—"}</div>
      </Row>

      <Row icon={<Syringe className="h-3.5 w-3.5" />} label="Vaccinations">
        <div className="flex items-center gap-1.5">
          {pet.vaccination_verified ? (
            <Badge variant="secondary" className="bg-primary-soft text-primary border-0 gap-1 text-[10px]">
              <ShieldCheck className="h-3 w-3" /> Verified
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300">
              Unverified
            </Badge>
          )}
        </div>
        {nextVaxDays !== null && (
          <div className={`text-[10px] mt-0.5 ${nextVaxDays < 0 ? "text-rose-600" : nextVaxDays <= 14 ? "text-amber-600" : "text-muted-foreground"}`}>
            Next: {nextVaxDays < 0 ? `${Math.abs(nextVaxDays)}d overdue` : nextVaxDays === 0 ? "due today" : `in ${nextVaxDays}d`}
          </div>
        )}
      </Row>

      <Row icon={<Bug className="h-3.5 w-3.5" />} label="Parasite">
        {nextParaDays === null ? (
          <div className="text-xs text-muted-foreground">No schedule</div>
        ) : (
          <div className={`text-xs ${nextParaDays < 0 ? "text-rose-600" : nextParaDays <= 7 ? "text-amber-600" : "text-muted-foreground"}`}>
            {nextParaDays < 0 ? `${Math.abs(nextParaDays)}d overdue` : nextParaDays === 0 ? "due today" : `in ${nextParaDays}d`}
          </div>
        )}
      </Row>

      <Row icon={<Pill className="h-3.5 w-3.5" />} label="Active meds">
        <div className="text-sm">{data?.meds?.length ?? 0}</div>
        {data?.meds && data.meds.length > 0 && (
          <div className="text-[10px] text-muted-foreground truncate">{data.meds.map((m: any) => m.name).join(", ")}</div>
        )}
      </Row>

      <Row icon={<Activity className="h-3.5 w-3.5" />} label="Symptoms · 7d">
        <div className={`text-sm ${(data?.symp?.length ?? 0) > 0 ? "text-amber-700 dark:text-amber-300" : ""}`}>
          {data?.symp?.length ?? 0}
        </div>
      </Row>

      <Row icon={<Heart className="h-3.5 w-3.5" />} label="Insurance">
        <div className="text-xs">{pet.insurance_provider ?? <span className="text-muted-foreground">None</span>}</div>
      </Row>

      {data?.weights && data.weights.length >= 2 && (
        <MiniChart points={data.weights as any[]} targetKg={targetKg} />
      )}
    </Card>
  );
};

const Row = ({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) => (
  <div className="border-t border-hairline pt-2">
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
      {icon}
      {label}
    </div>
    {children}
  </div>
);

const MiniChart = ({ points, targetKg }: { points: Array<{ recorded_at: string; weight_kg: number }>; targetKg: number | null }) => {
  const w = 200;
  const h = 40;
  const vals = points.map((p) => Number(p.weight_kg));
  const min = Math.min(...vals, ...(targetKg ? [Number(targetKg)] : []));
  const max = Math.max(...vals, ...(targetKg ? [Number(targetKg)] : []));
  const span = Math.max(0.1, max - min);
  const path = vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const targetY = targetKg ? h - ((Number(targetKg) - min) / span) * (h - 4) - 2 : null;
  return (
    <div className="border-t border-hairline pt-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Weight trend</div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10">
        {targetY !== null && (
          <line x1={0} y1={targetY} x2={w} y2={targetY} stroke="hsl(var(--destructive))" strokeWidth={0.5} strokeDasharray="3 3" opacity={0.6} />
        )}
        <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth={1.5} />
      </svg>
      <div className="text-[10px] text-muted-foreground">
        {format(new Date(points[0].recorded_at), "d MMM")} → {format(new Date(points[points.length - 1].recorded_at), "d MMM")}
      </div>
    </div>
  );
};

export default HealthCompare;
