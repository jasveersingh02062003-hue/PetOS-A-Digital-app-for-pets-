import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { SERVICE_CATEGORIES, TONE_BG } from "@/lib/serviceCategories";
import { useSeo } from "@/hooks/useSeo";

const HIDDEN: string[] = ["vet_clinic"]; // vets onboard via /vet/onboarding

const ProviderPicker = () => {
  const nav = useNavigate();
  useSeo({ title: "Pick your service", description: "Choose what you offer to pet parents." });

  const cats = SERVICE_CATEGORIES.filter((c) => !HIDDEN.includes(c.key));

  return (
    <div className="container-app pt-4 pb-24 max-w-lg">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="font-display text-2xl mb-1">What do you offer?</h1>
      <p className="text-sm text-muted-foreground mb-5">Pick the main service. You can add more later.</p>

      <div className="grid grid-cols-2 gap-2">
        {cats.map((c) => {
          const Icon = c.icon;
          return (
            <Card
              key={c.key}
              onClick={() => nav(`/onboarding/provider/${c.key}`)}
              className="rounded-2xl border border-hairline p-4 cursor-pointer hover:border-foreground/20 transition"
            >
              <div className={`h-10 w-10 rounded-xl grid place-items-center mb-2 ${TONE_BG[c.tone]}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="font-medium text-sm">{c.label}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{c.description}</div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ProviderPicker;