import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useNavigate } from "react-router-dom";
import { Scale, Syringe, Stethoscope } from "lucide-react";

/**
 * Small bottom sheet triggered by the Health-tab contextual FAB.
 * Three quick paths into existing health flows — no new backend.
 */
export const QuickLogSheet = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) => {
  const nav = useNavigate();

  const go = (to: string) => {
    onOpenChange(false);
    nav(to);
  };

  const items: { icon: any; label: string; sub: string; tone: string; to: string }[] = [
    { icon: Scale, label: "Log weight", sub: "Add a new vitals entry", tone: "text-leaf bg-leaf/12 ring-leaf/25", to: "/health" },
    { icon: Syringe, label: "Log vaccine", sub: "Record a vaccination", tone: "text-sky bg-sky/12 ring-sky/25", to: "/health" },
    { icon: Stethoscope, label: "Ask a vet", sub: "Describe a symptom", tone: "text-coral bg-coral/12 ring-coral/25", to: "/askvet/new" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-hairline">
        <SheetHeader className="text-left mb-2">
          <SheetTitle className="font-display text-xl">Quick log</SheetTitle>
        </SheetHeader>
        <div className="space-y-2 pb-4">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <button
                key={it.label}
                onClick={() => go(it.to)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-hairline bg-card active:scale-[0.99] transition-transform text-left"
              >
                <div className={`h-11 w-11 rounded-xl ring-1 grid place-items-center ${it.tone}`}>
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{it.label}</div>
                  <div className="text-xs text-muted-foreground">{it.sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};