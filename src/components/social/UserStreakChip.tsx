import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StreakChip } from "./StreakChip";

/**
 * Fetches a user's current daily-care streak and renders a compact
 * `StreakChip` only when the streak is meaningful (≥ minStreak, default 3).
 *
 * Cached by React Query so it's safe to drop into any list/header.
 */
export const UserStreakChip = ({
  userId,
  minStreak = 3,
  className,
}: {
  userId?: string | null;
  minStreak?: number;
  className?: string;
}) => {
  const { data } = useQuery({
    queryKey: ["user-streak", userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_streaks")
        .select("current_streak")
        .eq("user_id", userId!)
        .maybeSingle();
      return data?.current_streak ?? 0;
    },
  });
  const streak = data ?? 0;
  if (streak < minStreak) return null;
  return <StreakChip streak={streak} className={className} />;
};