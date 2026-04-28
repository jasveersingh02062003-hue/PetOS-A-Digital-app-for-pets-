import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Heart, MapPin } from "lucide-react";

export const SheltersNearYouRail = () => {
  const { data: profile } = useProfile();
  const myCity = profile?.city ?? null;

  const { data: shelters } = useQuery({
    queryKey: ["shelters-near-you", myCity],
    queryFn: async () => {
      const { data } = await supabase
        .from("org_profiles")
        .select("user_id, org_name, org_type, city, facility_photos, donation_upi, donation_url")
        .eq("status", "approved")
        .in("org_type", ["shelter", "sanctuary", "rescuer"])
        .limit(20);
      const list = data ?? [];
      // Sort: same-city first, then everything else
      return list.sort((a: any, b: any) => {
        const sa = myCity && a.city === myCity ? 0 : 1;
        const sb = myCity && b.city === myCity ? 0 : 1;
        return sa - sb;
      });
    },
  });

  if (!shelters?.length) return null;

  return (
    <section className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-lg leading-tight flex items-center gap-1.5">
          <Heart className="h-4 w-4 text-coral" fill="currentColor" /> Shelters near you
        </h2>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 sm:-mx-6 px-4 sm:px-6 pb-1">
        {shelters.map((s: any) => {
          const cover = (s.facility_photos ?? [])[0];
          return (
            <Link
              key={s.user_id}
              to={`/org/${s.user_id}`}
              className="shrink-0 w-[160px] rounded-2xl border border-hairline bg-card overflow-hidden hover:shadow-sm transition-shadow"
            >
              <div className="aspect-[4/3] bg-muted">
                {cover && <img src={cover} alt={s.org_name} className="w-full h-full object-cover" />}
              </div>
              <div className="p-2.5">
                <div className="text-sm font-medium truncate">{s.org_name}</div>
                <div className="flex items-center justify-between mt-1">
                  {s.city ? (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3 shrink-0" /> {s.city}
                    </span>
                  ) : <span />}
                  {(s.donation_upi || s.donation_url) && (
                    <span className="text-[10px] font-semibold text-coral">Donate</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};