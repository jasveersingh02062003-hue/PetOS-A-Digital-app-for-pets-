import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useTodaysPrompt } from "@/hooks/useDailyPrompt";

export const DailyPromptBanner = () => {
  const { data } = useTodaysPrompt();
  if (!data?.prompt || data.myMoment) return null;

  const dropped = new Date(data.prompt.dropped_at).getTime();
  const closes = dropped + data.prompt.window_minutes * 60_000;
  const remainingMin = Math.max(0, Math.round((closes - Date.now()) / 60_000));
  const onTime = remainingMin > 0;

  return (
    <Link
      to="/daily"
      className="block mx-4 mb-3 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/30 px-4 py-3"
    >
      <div className="flex items-center gap-2 mb-0.5">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">
          Daily Pet Moment
        </span>
        {onTime && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            {remainingMin}m left
          </span>
        )}
      </div>
      <p className="text-sm font-medium leading-snug">{data.prompt.prompt_text}</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {onTime ? "Post now to keep your streak →" : "Post late — streak resets"}
      </p>
    </Link>
  );
};
