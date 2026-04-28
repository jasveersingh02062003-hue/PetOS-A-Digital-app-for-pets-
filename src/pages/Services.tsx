import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Footprints,
  Hotel,
  Scissors,
  ShoppingBag,
  GraduationCap,
  Stethoscope,
  Plus,
  ClipboardList,
} from "lucide-react";
import { EmptyState } from "@/components/empty/EmptyState";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import type { Database } from "@/integrations/supabase/types";
import { SubjectRating } from "@/components/SubjectRating";

type ServiceCategory = Database["public"]["Enums"]["service_category"];

const categories: { key: ServiceCategory | "all"; label: string; icon: any }[] = [
  { key: "all", label: "All", icon: ShoppingBag },
  { key: "walking", label: "Walking", icon: Footprints },
  { key: "boarding", label: "Boarding", icon: Hotel },
  { key: "grooming", label: "Grooming", icon: Scissors },
  { key: "training", label: "Training", icon: GraduationCap },
  { key: "sitting", label: "Sitting", icon: Stethoscope },
];

const Services = () => {
  const [cat, setCat] = useState<ServiceCategory | "all">("all");

  const { data: providers, isLoading } = useQuery({
    queryKey: ["service_providers", cat],
    queryFn: async () => {
      let q = supabase
        .from("service_providers")
        .select("*")
        .eq("active", true)
        .order("verified", { ascending: false })
        .limit(50);
      if (cat !== "all") q = q.eq("category", cat);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="container-app pad-top-safe pb-24">
      <header className="pt-6 pb-4 flex items-center justify-between">
        <h1 className="font-display text-3xl">Services</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/services/manage">
              <ClipboardList className="h-4 w-4 mr-1.5" />
              Manage
            </Link>
          </Button>
          <Button asChild size="sm" className="rounded-full">
            <Link to="/services/new">
              <Plus className="h-4 w-4 mr-1.5" /> List
            </Link>
          </Button>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1 no-scrollbar">
        {categories.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setCat(key)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
              cat === key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-hairline text-foreground hover:bg-muted"
            }`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>

      <Link to="/shop" className="block mb-4">
        <Card className="rounded-2xl border-hairline bg-gradient-to-br from-primary/10 to-primary/5 p-5 flex items-center gap-4">
          <div className="bg-primary rounded-2xl h-12 w-12 flex items-center justify-center">
            <ShoppingBag className="h-5 w-5 text-primary-foreground" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <div className="font-display text-lg leading-tight">Shop</div>
            <div className="text-sm text-muted-foreground">
              Food, treats & accessories
            </div>
          </div>
        </Card>
      </Link>

      <div className="space-y-3">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading providers…</p>
        )}
        {!isLoading && (providers?.length ?? 0) === 0 && (
          <EmptyState
            icon={Footprints}
            title="No providers yet"
            description="Try a different category, or check back soon — new pros join Petos every week."
          />
        )}
        {providers?.map((p) => (
          <Link key={p.id} to={`/services/${p.id}`}>
            <Card className="rounded-2xl border-hairline bg-card shadow-none p-4 flex items-center gap-4 hover:bg-muted/40 transition-colors">
              <div className="bg-primary-soft rounded-2xl h-14 w-14 flex items-center justify-center overflow-hidden">
                {p.cover_url ? (
                  <img src={p.cover_url} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <Scissors className="h-5 w-5 text-primary" strokeWidth={1.5} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-display text-base leading-tight truncate">
                    {p.name}
                  </div>
                  {p.verified && (
                    <span className="text-[10px] rounded-full bg-primary/15 text-primary px-1.5 py-0.5 font-medium">
                      Verified
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {p.category} · {p.city || "—"}
                </div>
                <div className="mt-0.5">
                  <SubjectRating type="provider" id={p.id} size="sm" />
                </div>
              </div>
              {p.hourly_rate_inr ? (
                <div className="text-sm font-medium">
                  ₹{p.hourly_rate_inr}
                  <span className="text-xs text-muted-foreground">/hr</span>
                </div>
              ) : null}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Services;
