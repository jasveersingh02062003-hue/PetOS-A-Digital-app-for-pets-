import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { BadgeCheck, Cake } from "lucide-react";
import { format } from "date-fns";

export const LittersList = ({ userId }: { userId: string }) => {
  const { data: litters, isLoading } = useQuery({
    queryKey: ["litters-by-user", userId],
    queryFn: async () => {
      const { data: groups } = await supabase
        .from("litter_groups")
        .select("id, birth_date, notes, sire_pet_id, dam_pet_id, created_at")
        .eq("created_by", userId)
        .order("created_at", { ascending: false });

      const list = groups ?? [];
      if (!list.length) return [];

      const litterIds = list.map((l) => l.id);
      const { data: pups } = await supabase
        .from("litter_pets")
        .select("litter_id, pet_id")
        .in("litter_id", litterIds);

      // Resolve all referenced pet ids via public RPC
      const refIds = new Set<string>();
      list.forEach((l) => {
        if (l.sire_pet_id) refIds.add(l.sire_pet_id);
        if (l.dam_pet_id) refIds.add(l.dam_pet_id);
      });
      (pups ?? []).forEach((p) => refIds.add(p.pet_id));

      const { data: petsAll } = await supabase.rpc("get_pets_public");
      const map = new Map<string, any>();
      (petsAll ?? []).forEach((p: any) => map.set(p.id, p));

      return list.map((l) => ({
        ...l,
        sire: l.sire_pet_id ? map.get(l.sire_pet_id) : null,
        dam: l.dam_pet_id ? map.get(l.dam_pet_id) : null,
        pups: (pups ?? [])
          .filter((p) => p.litter_id === l.id)
          .map((p) => map.get(p.pet_id))
          .filter(Boolean),
      }));
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground py-6 text-center">Loading litters…</div>;
  if (!litters?.length)
    return <div className="text-sm text-muted-foreground py-8 text-center">No litters recorded yet.</div>;

  return (
    <div className="space-y-3">
      {litters.map((l: any) => (
        <Card key={l.id} className="rounded-2xl border-hairline shadow-none p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <BadgeCheck className="h-3 w-3 text-leaf" /> Bred on PetOS
            </div>
            {l.birth_date && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Cake className="h-3 w-3" /> {format(new Date(l.birth_date), "MMM d, yyyy")}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <ParentMini label="Sire" pet={l.sire} />
            <ParentMini label="Dam" pet={l.dam} />
          </div>
          {l.pups.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Pups ({l.pups.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {l.pups.map((p: any) => (
                  <Link
                    key={p.id}
                    to={`/pet/${p.public_id ?? p.id}`}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/60 hover:bg-muted text-xs"
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={p.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[10px] bg-primary-soft text-primary">{p.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{p.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {l.notes && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{l.notes}</p>}
        </Card>
      ))}
    </div>
  );
};

const ParentMini = ({ label, pet }: { label: string; pet?: any }) => {
  if (!pet) {
    return (
      <div className="rounded-xl border border-dashed border-hairline p-2 text-center text-[11px] text-muted-foreground">
        {label} unknown
      </div>
    );
  }
  return (
    <Link to={`/pet/${pet.public_id ?? pet.id}`} className="rounded-xl border border-hairline p-2 flex items-center gap-2 hover:bg-muted/40">
      <Avatar className="h-8 w-8">
        <AvatarImage src={pet.avatar_url ?? undefined} />
        <AvatarFallback className="bg-primary-soft text-primary text-xs">{pet.name?.[0]}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-xs font-medium truncate">{pet.name}</div>
      </div>
    </Link>
  );
};