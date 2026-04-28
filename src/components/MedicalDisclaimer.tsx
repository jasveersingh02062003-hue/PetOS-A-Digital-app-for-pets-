import { AlertTriangle } from "lucide-react";

/**
 * Calm, consistent disclaimer shown anywhere Petos surfaces health guidance.
 * Single source of truth — update copy here and it propagates app-wide.
 */
export const MedicalDisclaimer = ({ variant = "soft" }: { variant?: "soft" | "inline" }) => {
  if (variant === "inline") {
    return (
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Petos AI gives general guidance, not a diagnosis. For emergencies, contact your vet immediately.
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-hairline bg-muted/40 p-3 flex gap-2.5 items-start">
      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Petos AI gives general guidance, not a medical diagnosis. For emergencies — bleeding, breathing trouble, seizures, suspected poisoning — contact your vet immediately.
      </p>
    </div>
  );
};
