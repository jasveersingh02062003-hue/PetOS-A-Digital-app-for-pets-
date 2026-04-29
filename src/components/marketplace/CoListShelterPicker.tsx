import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { BadgeCheck, Search, X } from "lucide-react";

export type CoListShelter = { user_id: string; org_name: string; city: string | null };

/**
 * Mandatory shelter picker for unverified rescuers creating an adoption listing.
 * Only lists `org_profiles` rows where status='approved' AND org_type='shelter'.
 */
export const CoListShelterPicker = ({
  value,
  onChange,
}: {
  value: CoListShelter | null;
  onChange: (s: CoListShelter | null) => void;
}) => {
  const [q, setQ] = useState("");

  const { data: shelters } = useQuery({
    queryKey: ["approved-shelters"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_profiles")
        .select("user_id, org_name, city")
        .eq("status", "approved")
        .eq("org_type", "shelter")
        .order("org_name");
      if (error) throw error;
      return (data ?? []) as CoListShelter[];
    },
  });

  const filtered = (shelters ?? []).filter((s) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return s.org_name.toLowerCase().includes(needle) || (s.city ?? "").toLowerCase().includes(needle);
  }).slice(0, 8);

  if (value) {
    return (
      <div className="rounded-xl border border-leaf/40 bg-leaf/5 p-3 flex items-center gap-2">
        <BadgeCheck className="h-4 w-4 text-leaf shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{value.org_name}</div>
          <div className="text-[11px] text-muted-foreground truncate">{value.city ?? "Approved shelter"}</div>
        </div>
        <button onClick={() => onChange(null)} className="text-muted-foreground hover:text-foreground p-1" aria-label="Clear">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search approved shelters by name or city"
          className="pl-9 rounded-xl"
        />
      </div>
      <div className="max-h-56 overflow-y-auto rounded-xl border border-hairline divide-y divide-hairline">
        {filtered.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">No approved shelters match.</div>
        ) : filtered.map((s) => (
          <button
            key={s.user_id}
            onClick={() => onChange(s)}
            className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center gap-2"
          >
            <BadgeCheck className="h-3.5 w-3.5 text-leaf shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{s.org_name}</div>
              {s.city && <div className="text-[10px] text-muted-foreground truncate">{s.city}</div>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};