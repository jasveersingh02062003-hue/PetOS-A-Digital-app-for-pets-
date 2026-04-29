import { Sparkles, GitBranch } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PedigreeSheet } from "@/components/breeder/PedigreeSheet";

export const BredOnPetosRibbon = ({ litterId }: { litterId?: string | null }) => {
  const [pedigreeOpen, setPedigreeOpen] = useState(false);
  const { data: litter } = useQuery({
    queryKey: ["litter", litterId],
    enabled: !!litterId,
    queryFn: async () => {
      const { data: lg } = await supabase
        .from("litter_groups")
        .select("id, sire_pet_id, dam_pet_id")
        .eq("id", litterId!)
        .maybeSingle();
      if (!lg) return null;
      const ids = [lg.sire_pet_id, lg.dam_pet_id].filter(Boolean) as string[];
      const { data: pets } = ids.length
        ? await supabase.from("pets").select("id, name, public_id").in("id", ids)
        : { data: [] as any[] };
      const sire = pets?.find((p) => p.id === lg.sire_pet_id);
      const dam = pets?.find((p) => p.id === lg.dam_pet_id);
      return { ...lg, sire, dam } as any;
    },
  });

  if (!litterId) return null;

  const seedPetId = litter?.sire?.id ?? litter?.dam?.id ?? "";

  return (
    <>
    <div className="rounded-2xl bg-gradient-to-r from-coral/10 via-lilac/10 to-sky/10 border border-coral/20 p-3 flex items-center gap-2 text-xs">
      <Sparkles className="h-4 w-4 text-coral shrink-0" />
      <div className="flex-1">
        <div className="font-semibold text-foreground">Bred on PetOS</div>
        <div className="text-muted-foreground">
          Parents tracked on PetOS{" "}
          {litter?.sire?.public_id && (
            <>
              · <Link className="underline" to={`/pet/${litter.sire.public_id}`}>{litter.sire.name}</Link>
            </>
          )}
          {litter?.dam?.public_id && (
            <>
              {" "}× <Link className="underline" to={`/pet/${litter.dam.public_id}`}>{litter.dam.name}</Link>
            </>
          )}
        </div>
      </div>
      {seedPetId && (
        <button
          onClick={() => setPedigreeOpen(true)}
          className="shrink-0 inline-flex items-center gap-1 text-coral hover:text-coral/80 font-semibold text-[11px] px-2 h-7 rounded-full border border-coral/30 bg-card"
          aria-label="View pedigree"
        >
          <GitBranch className="h-3 w-3" /> Pedigree
        </button>
      )}
    </div>
    {seedPetId && (
      <PedigreeSheet open={pedigreeOpen} onOpenChange={setPedigreeOpen} initialPetId={seedPetId} />
    )}
    </>
  );
};