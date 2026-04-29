import { Card } from "@/components/ui/card";
import { Smile, UtensilsCrossed, Footprints, Moon, Camera, Stethoscope } from "lucide-react";

/**
 * Static viewer-side preview of what a kennel daily report looks like.
 * Surfaced on public kennel profiles so prospective customers know exactly
 * what to expect each evening during a stay.
 */
export const DailyReportSamplePreview = () => {
  return (
    <Card className="rounded-2xl border-hairline bg-card p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
        Sample daily report
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        This is what you'll receive each evening while your pet stays here.
      </p>

      <div className="rounded-xl border border-hairline bg-background/60 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-display text-sm">Buddy · Day 2</div>
          <span className="inline-flex items-center gap-1 text-[11px] text-leaf bg-leaf/10 border border-leaf/30 rounded-full px-2 py-0.5">
            <Smile className="h-3 w-3" /> Mood: great
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg bg-muted/40 p-2 flex items-center gap-1.5">
            <UtensilsCrossed className="h-3.5 w-3.5 text-coral" />
            <span><span className="font-semibold">2</span> meals</span>
          </div>
          <div className="rounded-lg bg-muted/40 p-2 flex items-center gap-1.5">
            <Footprints className="h-3.5 w-3.5 text-sky" />
            <span><span className="font-semibold">3</span> walks</span>
          </div>
          <div className="rounded-lg bg-muted/40 p-2 flex items-center gap-1.5">
            <Moon className="h-3.5 w-3.5 text-lilac" />
            <span>Slept well</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="aspect-square rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground">
            <Camera className="h-5 w-5" />
          </div>
          <div className="aspect-square rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground">
            <Camera className="h-5 w-5" />
          </div>
        </div>

        <div className="text-xs text-foreground bg-amber-50/60 border border-amber-200/50 rounded-lg p-2">
          <span className="font-semibold">Notes:</span> Buddy enjoyed the morning play session and made a new friend at the park.
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Stethoscope className="h-3 w-3" /> No incidents reported
        </div>
      </div>
    </Card>
  );
};

export default DailyReportSamplePreview;