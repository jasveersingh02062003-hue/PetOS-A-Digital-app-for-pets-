import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Seeded editorial content so a brand new user never sees a "ghost town" feed.
// Rotated daily by date so it feels alive without needing a backend.
const TIPS = [
  { t: "Hydration matters more than you think", b: "Most dogs need ~50ml of water per kg per day. A quiet water bowl is a sign — refresh it twice today." },
  { t: "The 5-second pavement test", b: "If you can't hold the back of your hand on the pavement for 5 seconds, it's too hot for paws. Walk at dawn or dusk in summer." },
  { t: "One new smell = a tired pet", b: "A 20-minute sniff walk tires a dog more than a 1-hour fast walk. Mental stimulation > distance." },
  { t: "Brush, don't bathe", b: "Daily brushing spreads natural oils and beats shampoo for shine. Cats: bathing is rarely needed at all." },
  { t: "Look at the gums, not the nose", b: "A wet nose isn't a health signal. Pink, moist gums are. Pale or sticky gums = call a vet." },
  { t: "Two meals beat one", b: "Splitting daily food into two meals stabilises blood sugar and reduces bloat risk in deep-chested breeds." },
  { t: "Vaccines have a quiet window", b: "Immunity peaks ~2 weeks after a booster. Plan boarding, travel, or playdates around that window." },
];

export const DailyTipCard = () => {
  const nav = useNavigate();
  // pick by day-of-year so it changes daily but is stable per-day
  const idx = Math.floor(Date.now() / 86_400_000) % TIPS.length;
  const tip = TIPS[idx];

  return (
    <Card
      onClick={() => nav("/ai")}
      className="rounded-2xl border-hairline bg-gradient-to-br from-primary/8 to-primary/3 shadow-none p-5 cursor-pointer hover:from-primary/12 hover:to-primary/5 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-primary" strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-primary font-semibold">Today's tip</div>
          <div className="font-display text-base mt-1 leading-snug">{tip.t}</div>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{tip.b}</p>
          <div className="text-xs text-primary font-medium mt-3">Ask the AI vet anything →</div>
        </div>
      </div>
    </Card>
  );
};
