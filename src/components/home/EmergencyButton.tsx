import { useNavigate } from "react-router-dom";
import { Siren } from "lucide-react";

/**
 * Big, unmissable SOS button on Home — the entry point for the
 * pet-context-aware AI Doctor. Distinct red emergency tone so it
 * stands apart from the regular AI chat in the QuickAccessRail.
 */
export const EmergencyButton = () => {
  const nav = useNavigate();
  return (
    <button
      onClick={() => nav("/vet-triage")}
      aria-label="Emergency — talk to AI vet"
      className="w-full rounded-3xl border border-emergency/25 bg-gradient-to-br from-emergency/15 via-card to-emergency/5 p-4 mb-4 active:scale-[0.99] transition-transform card-elev flex items-center gap-3"
    >
      <div className="h-12 w-12 rounded-2xl bg-emergency/15 ring-1 ring-emergency/25 flex items-center justify-center shrink-0">
        <Siren className="h-6 w-6 text-emergency" strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="font-display text-base leading-tight text-foreground">Emergency? Ask DogtorAI</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          Pet-context triage in seconds — escalates to a live vet if needed
        </div>
      </div>
      <div className="text-[11px] font-semibold text-emergency">SOS</div>
    </button>
  );
};
