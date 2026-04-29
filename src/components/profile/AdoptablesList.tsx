import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Heart, MapPin } from "lucide-react";

/**
 * Lists active adoption-style pet_listings owned by `userId`.
 * Used on shelter / sanctuary / rescuer profiles.
 */
export const AdoptablesList = ({ userId }: { userId: string }) => {
  const { data, isLoading } = useQuery({
    queryKey: ["profile-adoptables", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_listings")
        .select("id, title, photos, city, species, breed, fee_inr, listing_type, status, active, created_at")
        .eq("owner_id", userId)
        .in("listing_type", ["adoption", "rehoming"])
        .eq("active", true)
        .neq("status", "taken_down")
        .neq("status", "sold")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!data?.length) {
    return (
      <Card className="rounded-2xl border-hairline p-6 text-center">
        <Heart className="h-7 w-7 mx-auto text-muted-foreground mb-2" strokeWidth={1.5} />
        <div className="text-sm text-muted-foreground">No animals listed for adoption.</div>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {data.map((l: any) => {
        const cover = Array.isArray(l.photos) && l.photos.length > 0 ? l.photos[0] : null;
        return (
          <Link key={l.id} to={`/mates/adopt/${l.id}`} className="group">
            <Card className="overflow-hidden rounded-2xl border-hairline shadow-none">
              <div className="aspect-square bg-muted overflow-hidden">
                {cover ? (
                  <img src={cover} alt={l.title ?? "Adoptable"} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" loading="lazy" />
                ) : (
                  <div className="w-full h-full grid place-items-center">
                    <Heart className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="p-2">
                <div className="text-xs font-medium truncate">{l.title || l.breed || l.species || "Pet"}</div>
                <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                  {l.city ? <><MapPin className="h-3 w-3" />{l.city}</> : <span>{l.species}</span>}
                </div>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
};

export default AdoptablesList;