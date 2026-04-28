import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { PawPrint, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

type PetNode = {
  id: string;
  name: string | null;
  public_id: string | null;
  avatar_url: string | null;
  breed: string | null;
  sire_pet_id: string | null;
  dam_pet_id: string | null;
};

async function fetchPet(id: string): Promise<PetNode | null> {
  const { data } = await supabase
    .from("pets")
    .select("id, name, public_id, avatar_url, breed, sire_pet_id, dam_pet_id")
    .eq("id", id)
    .maybeSingle();
  return (data as PetNode) ?? null;
}

async function fetchTree(rootId: string, depth = 3): Promise<Record<string, PetNode>> {
  const cache: Record<string, PetNode> = {};
  const queue: { id: string; d: number }[] = [{ id: rootId, d: 0 }];
  while (queue.length) {
    const { id, d } = queue.shift()!;
    if (cache[id] || d >= depth) continue;
    const p = await fetchPet(id);
    if (!p) continue;
    cache[id] = p;
    if (p.sire_pet_id) queue.push({ id: p.sire_pet_id, d: d + 1 });
    if (p.dam_pet_id) queue.push({ id: p.dam_pet_id, d: d + 1 });
  }
  return cache;
}

const PetCell = ({ pet, label }: { pet: PetNode | null | undefined; label: string }) => {
  if (!pet) {
    return (
      <div className="rounded-xl border border-dashed border-hairline bg-muted/30 p-2 text-center text-[10px] text-muted-foreground min-w-[80px]">
        <div className="h-8 w-8 mx-auto rounded-full bg-muted grid place-items-center mb-1">
          <PawPrint className="h-3.5 w-3.5 opacity-40" />
        </div>
        Unknown
        <div className="text-[9px] uppercase tracking-wider opacity-60">{label}</div>
      </div>
    );
  }
  return (
    <Link
      to={pet.public_id ? `/pet/${pet.public_id}` : "#"}
      className="rounded-xl border border-hairline bg-card p-2 text-center text-[10px] min-w-[80px] hover:shadow-sm transition-shadow block"
    >
      <div className="h-8 w-8 mx-auto rounded-full bg-muted overflow-hidden mb-1">
        {pet.avatar_url ? (
          <img src={pet.avatar_url} alt={pet.name ?? ""} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center text-coral font-display">{pet.name?.[0] ?? "?"}</div>
        )}
      </div>
      <div className="font-medium truncate">{pet.name ?? "—"}</div>
      <div className="text-[9px] uppercase tracking-wider opacity-60">{label}</div>
    </Link>
  );
};

export const LineageTree = ({ petId }: { petId?: string | null }) => {
  const { data: tree, isLoading } = useQuery({
    queryKey: ["lineage", petId],
    enabled: !!petId,
    queryFn: () => fetchTree(petId!, 3),
  });

  if (!petId) return null;
  if (isLoading) {
    return <Card className="rounded-2xl border-hairline p-4 text-xs text-muted-foreground">Loading lineage…</Card>;
  }
  if (!tree) return null;

  const root = tree[petId];
  if (!root) return null;

  const sire = root.sire_pet_id ? tree[root.sire_pet_id] : null;
  const dam = root.dam_pet_id ? tree[root.dam_pet_id] : null;
  const sireSire = sire?.sire_pet_id ? tree[sire.sire_pet_id] : null;
  const sireDam = sire?.dam_pet_id ? tree[sire.dam_pet_id] : null;
  const damSire = dam?.sire_pet_id ? tree[dam.sire_pet_id] : null;
  const damDam = dam?.dam_pet_id ? tree[dam.dam_pet_id] : null;

  const hasAny = sire || dam || sireSire || sireDam || damSire || damDam;
  if (!hasAny) return null;

  return (
    <Card className="rounded-2xl border-hairline p-4 mb-3 overflow-x-auto">
      <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold">
        <Sparkles className="h-3.5 w-3.5 text-coral" />
        Family tree
      </div>

      <div className="grid grid-cols-3 gap-3 items-center min-w-[420px]">
        {/* Self */}
        <div className="flex justify-center">
          <PetCell pet={root} label="Self" />
        </div>
        {/* Parents */}
        <div className="grid grid-rows-2 gap-2">
          <PetCell pet={sire} label="Sire" />
          <PetCell pet={dam} label="Dam" />
        </div>
        {/* Grandparents */}
        <div className="grid grid-rows-4 gap-1.5">
          <PetCell pet={sireSire} label="GSire" />
          <PetCell pet={sireDam} label="GDam" />
          <PetCell pet={damSire} label="GSire" />
          <PetCell pet={damDam} label="GDam" />
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
        Tap any ancestor to view their full profile and health history. Pets tracked on PetOS pass on verified lineage to their offspring.
      </div>
    </Card>
  );
};