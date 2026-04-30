import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInCalendarDays } from "date-fns";
import { ShieldCheck, Syringe, Pill } from "lucide-react";

type Pet = { id: string; name: string; avatar_url?: string | null };

/** Compact horizontal strip shown on /health when the user has 2+ pets.
 *  Tap a pet to switch the active selection. */
export const MultiPetSummary = ({
  pets,
  activeId,
  onSelect,
}: {
  pets: Pet[];
  activeId?: string;
  onSelect: (id: string) => void;
}) => {
  const ids = pets.map((p) => p.id);

  const { data: rows } = useQuery({
    queryKey: ["multi-pet-status", ids],
    enabled: ids.length > 1,
    queryFn: async () => {
      const { data } = await supabase
        .from("pet_health_status" as any)
        .select("pet_id, vaccination_verified, next_parasite_due")
        .in("pet_id", ids);
      return (data ?? []) as any[];
    },
  });

  const { data: meds } = useQuery({
    queryKey: ["multi-pet-active-meds", ids],
    enabled: ids.length > 1,
    queryFn: async () => {
      const { data } = await supabase
        .from("medication_logs" as any)
        .select("pet_id, name, active")
        .in("pet_id", ids)
        .eq("active", true);
      return (data ?? []) as any[];
    },
  });

  if (pets.length < 2) return null;

  const summaryFor = (petId: string) => {
    const s = rows?.find((r) => r.pet_id === petId);
    const activeMed = meds?.find((m) => m.pet_id === petId);
    if (s?.next_parasite_due) {
      const d = differenceInCalendarDays(new Date(s.next_parasite_due), new Date());
      if (d < 0) return { icon: <Syringe className="h-3 w-3" />, label: "Parasite overdue", tone: "text-rose-600" };
      if (d <= 7) return { icon: <Syringe className="h-3 w-3" />, label: `Parasite ${d}d`, tone: "text-amber-600" };
    }
    if (s && !s.vaccination_verified) return { icon: <Syringe className="h-3 w-3" />, label: "Vax pending", tone: "text-amber-600" };
    if (activeMed) return { icon: <Pill className="h-3 w-3" />, label: activeMed.name, tone: "text-primary" };
    return { icon: <ShieldCheck className="h-3 w-3" />, label: "All clear", tone: "text-emerald-600" };
  };

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 mb-3">
      {pets.map((p) => {
        const s = summaryFor(p.id);
        const isActive = p.id === activeId;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`shrink-0 rounded-2xl border p-3 min-w-[150px] text-left transition-colors ${
              isActive ? "bg-primary-soft border-primary" : "bg-card border-hairline"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-muted overflow-hidden flex items-center justify-center text-xs">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  p.name.slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className={`text-[11px] flex items-center gap-1 ${s.tone}`}>
                  {s.icon}
                  <span className="truncate">{s.label}</span>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};