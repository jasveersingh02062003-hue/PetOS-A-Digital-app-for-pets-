import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sparkles, Check } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
  reason?: string;
  perks?: string[];
};

/**
 * Soft upgrade prompt. Shown when a free user hits a limit.
 * Calm copy. No countdowns, no urgency tactics.
 */
export const TierGate = ({ open, onOpenChange, feature, reason, perks }: Props) => {
  const nav = useNavigate();
  const items = perks ?? [
    "Unlimited AI chats",
    "2 vet consults per month",
    "Unlimited missing-pet alerts",
    "Custom vault share durations",
    "Plus badge on your profile",
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-hairline px-5 pb-8 pt-6">
        <SheetHeader className="text-left">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Sparkles className="h-5 w-5 text-primary" strokeWidth={1.8} />
          </div>
          <SheetTitle className="font-display text-2xl">{feature}</SheetTitle>
          <SheetDescription className="text-sm">
            {reason ?? "Upgrade to Petos Plus to continue."}
          </SheetDescription>
        </SheetHeader>

        <ul className="mt-5 space-y-2.5">
          {items.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Check className="h-2.5 w-2.5 text-primary" strokeWidth={3} />
              </span>
              <span className="text-foreground">{p}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 space-y-2">
          <Button className="w-full h-12 rounded-2xl" onClick={() => { onOpenChange(false); nav("/plus"); }}>
            See Plus
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
