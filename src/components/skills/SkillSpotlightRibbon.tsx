import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

/**
 * Orange "Skill Spotlight · {skill}" corner ribbon overlaid on a post photo.
 * Renders nothing if no spotlightId or the spotlight cannot be loaded.
 */
export const SkillSpotlightRibbon = ({ spotlightId }: { spotlightId?: string | null }) => {
  const { data } = useQuery({
    queryKey: ["spotlight-ribbon", spotlightId],
    enabled: !!spotlightId,
    queryFn: async () => {
      const { data: s } = await supabase
        .from("skill_spotlights")
        .select("id, crowd_favourite_at, skill:pet_skills(name)")
        .eq("id", spotlightId!)
        .maybeSingle();
      return s as any;
    },
  });

  if (!spotlightId || !data) return null;
  const skillName = data.skill?.name ?? "Skill";
  const isFav = !!data.crowd_favourite_at;

  return (
    <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-full bg-orange-500/95 text-white px-2.5 py-1 text-[11px] font-semibold shadow-md backdrop-blur">
      <Sparkles className="h-3 w-3" />
      <span>Skill Spotlight · {skillName}</span>
      {isFav && <span className="ml-1 rounded-full bg-amber-300 text-amber-900 px-1.5 py-0.5 text-[9px] font-bold">★ Crowd-fav</span>}
    </div>
  );
};