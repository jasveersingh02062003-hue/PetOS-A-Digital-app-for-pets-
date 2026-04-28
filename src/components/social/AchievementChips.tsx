import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Award, Bug, Calendar, Camera, Flame, Heart, Shield, Sparkles, Stethoscope, Users } from "lucide-react";

const ICONS: Record<string, any> = {
  first_post: Camera,
  streak_7: Flame,
  streak_30: Flame,
  vaccinated: Shield,
  dewormed_recent: Bug,
  first_mate: Heart,
  meetup_host: Calendar,
  social_butterfly: Users,
  helpful_vet: Stethoscope,
  daily_moment_first: Sparkles,
  daily_streak_7: Flame,
  daily_streak_30: Flame,
  default: Award,
};
const LABELS: Record<string, string> = {
  first_post: "First post",
  streak_7: "7-day streak",
  streak_30: "30-day streak",
  vaccinated: "Vaccinated",
  dewormed_recent: "Dewormed",
  first_mate: "First mate",
  meetup_host: "Meetup host",
  social_butterfly: "Social butterfly",
  helpful_vet: "Helpful vet",
  daily_moment_first: "First moment",
  daily_streak_7: "7-day moments",
  daily_streak_30: "30-day moments",
};

export const AchievementChips = ({ userId }: { userId: string }) => {
  const { data } = useQuery({
    queryKey: ["achievements", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("achievements").select("*").eq("user_id", userId).order("earned_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!data?.length) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <Sparkles className="h-6 w-6 mx-auto mb-2 opacity-50" />
        Earn your first badge by sharing a moment.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {data.map((a: any) => {
        const Icon = ICONS[a.kind] ?? ICONS.default;
        return (
          <div key={a.id} className="flex items-center gap-1.5 rounded-full bg-primary-soft text-primary px-3 py-1.5 text-xs font-medium">
            <Icon className="h-3.5 w-3.5" />
            {LABELS[a.kind] ?? a.kind}
          </div>
        );
      })}
    </div>
  );
};
