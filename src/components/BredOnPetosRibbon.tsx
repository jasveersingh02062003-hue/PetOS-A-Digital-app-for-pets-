import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const BredOnPetosRibbon = ({ litterId }: { litterId?: string | null }) => {
  const { data: litter } = useQuery({
    queryKey: ["litter", litterId],
    enabled: !!litterId,
    queryFn: async () => {
      const { data } = await supabase
        .from("litter_groups")
        .select("id, sire_pet_id, dam_pet_id, sire:pets!litter_groups_sire_pet_id_fkey(name, public_id), dam:pets!litter_groups_dam_pet_id_fkey(name, public_id)")
        .eq("id", litterId!)
        .maybeSingle();
      return data as any;
    },
  });

  if (!litterId) return null;

  return (
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
    </div>
  );
};