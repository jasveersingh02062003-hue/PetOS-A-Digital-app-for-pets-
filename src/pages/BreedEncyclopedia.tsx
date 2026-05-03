import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, ArrowLeft, IndianRupee } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";

const SPECIES = [
  { key: "all", label: "All", emoji: "🐾" },
  { key: "dog", label: "Dogs", emoji: "🐶" },
  { key: "cat", label: "Cats", emoji: "🐱" },
  { key: "rabbit", label: "Rabbits", emoji: "🐰" },
  { key: "bird", label: "Birds", emoji: "🦜" },
  { key: "other", label: "Other", emoji: "🐹" },
];

export default function BreedEncyclopedia() {
  useSeo({ title: "Breed Encyclopedia — Pet breed guide for India", description: "Browse all dog, cat, rabbit, bird and small-pet breeds with India-specific climate, cost and care info." });
  const nav = useNavigate();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  const { data: breeds, isLoading } = useQuery({
    queryKey: ["breed-profiles", filter],
    queryFn: async () => {
      let query = supabase.from("breed_profiles").select("*").order("popularity", { ascending: false });
      if (filter !== "all") query = query.eq("species", filter);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = (breeds ?? []).filter((b: any) =>
    !q || `${b.breed} ${b.species}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="container-app pad-top-safe pb-16">
      <header className="pt-6 pb-4">
        <button onClick={() => nav(-1)} className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-3">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold inline-flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" /> Encyclopedia
        </div>
        <h1 className="font-display text-[28px] mt-1 leading-tight">All breeds</h1>
        <p className="text-sm text-muted-foreground mt-1">India-specific care, cost and climate fit.</p>
      </header>

      <div className="relative mb-3">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search breeds…" className="pl-9 h-11 rounded-xl border-hairline" />
      </div>

      <div className="overflow-x-auto no-scrollbar mb-4 -mx-1">
        <div className="flex gap-2 px-1 w-max">
          {SPECIES.map((s) => (
            <button
              key={s.key}
              onClick={() => setFilter(s.key)}
              className={`shrink-0 h-9 px-3 rounded-full text-xs font-medium border ${filter === s.key ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-hairline"}`}
            >
              <span className="mr-1">{s.emoji}</span>{s.label}
            </button>
          ))}
        </div>
      </div>

      <button onClick={() => nav("/find-my-pet")} className="w-full mb-5 rounded-2xl border border-hairline p-4 bg-gradient-to-br from-primary/10 to-coral/10 text-left">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <div className="font-display text-base">Not sure what to get?</div>
            <div className="text-xs text-muted-foreground">Take the 2-minute quiz</div>
          </div>
          <span className="text-xs font-semibold text-primary">Start →</span>
        </div>
      </button>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

      <div className="grid gap-3">
        {filtered.map((b: any) => (
          <Card
            key={b.id}
            onClick={() => nav(`/breeds/${encodeURIComponent(b.species)}/${encodeURIComponent(b.breed)}`)}
            className="p-4 rounded-2xl border-hairline cursor-pointer hover:bg-muted/20 active:scale-[0.99] transition-all"
          >
            <div className="flex justify-between items-start mb-1">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{b.species}</div>
                <div className="font-display text-lg">{b.breed}</div>
              </div>
              {b.experience_level && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted">{b.experience_level}</span>
              )}
            </div>
            {b.short_summary && <p className="text-sm text-muted-foreground line-clamp-2">{b.short_summary}</p>}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {b.monthly_cost_min != null && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted inline-flex items-center gap-1">
                  <IndianRupee className="h-3 w-3" />{b.monthly_cost_min.toLocaleString()}–{b.monthly_cost_max?.toLocaleString()}/mo
                </span>
              )}
              {b.exercise_hours_per_day != null && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted">{b.exercise_hours_per_day}hr/day</span>
              )}
              {b.apartment_friendly && <span className="text-[11px] px-2 py-0.5 rounded-full bg-leaf/10 text-leaf">Apartment OK</span>}
              {b.climate_warnings && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber/10 text-amber">⚠ Climate</span>}
            </div>
          </Card>
        ))}
        {!isLoading && filtered.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8">No breeds found.</div>
        )}
      </div>
    </div>
  );
}
