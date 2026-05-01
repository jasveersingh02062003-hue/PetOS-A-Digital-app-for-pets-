import { useNavigate } from "react-router-dom";
import { Siren, ChevronRight } from "lucide-react";

/**
 * Slim emergency ribbon. Compact one-liner so the hero pet card stays
 * dominant above the fold — the existing floating red FAB already covers
 * the "always-visible" SOS pattern.
 */
export const EmergencyButton = () => {
  const nav = useNavigate();
  return (
    <button
      onClick={() => nav("/vet-triage")}
      aria-label="Emergency — talk to AI vet"
      className="w-full rounded-2xl border border-emergency/25 bg-emergency/8 hover:bg-emergency/12 px-3 py-2 mb-4 active:scale-[0.99] transition-all flex items-center gap-2.5 group"
    >
      <span className="h-7 w-7 rounded-full bg-emergency/15 flex items-center justify-center shrink-0">
        <Siren className="h-3.5 w-3.5 text-emergency" strokeWidth={2.4} />
      </span>
      <span className="flex-1 min-w-0 text-left text-[13px] font-medium text-foreground/90">
        Emergency? <span className="text-muted-foreground font-normal">Ask DogtorAI now</span>
      </span>
      <span className="text-[10px] font-bold text-emergency tracking-wider">SOS</span>
      <ChevronRight className="h-4 w-4 text-emergency/60 group-hover:translate-x-0.5 transition-transform" />
    </button>
  );
};
