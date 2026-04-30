import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PawPrint, ArrowRight, Plus } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";

/**
 * Shown after the pet-parent finishes the wizard for a pet.
 * Lets them loop back to add another pet, or finish onto the home dashboard.
 * Adding another pet routes to /onboarding/add-pet (the lightweight quick-add).
 */
export default function AddAnotherPet() {
  const nav = useNavigate();
  useSeo({ title: "Add another pet?", description: "You can add as many pets as you like." });

  return (
    <div className="container-app pt-10 pb-24 max-w-lg">
      <div className="text-center mb-8">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 grid place-items-center mb-4">
          <PawPrint className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl mb-1">Add another pet?</h1>
        <p className="text-sm text-muted-foreground">
          You can add as many pets as you'd like. Each one gets its own profile, health vault and feed.
        </p>
      </div>

      <div className="space-y-3">
        <Card
          onClick={() => nav("/onboarding/add-pet")}
          className="rounded-2xl border border-hairline p-4 cursor-pointer hover:border-primary/30 transition flex items-center gap-3"
        >
          <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
            <Plus className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium">Add another pet</div>
            <div className="text-xs text-muted-foreground">Quick add — name, species, breed</div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Card>

        <Card
          onClick={() => nav("/", { replace: true })}
          className="rounded-2xl border border-hairline p-4 cursor-pointer hover:border-foreground/20 transition flex items-center gap-3"
        >
          <div className="h-10 w-10 rounded-xl bg-muted grid place-items-center">
            <ArrowRight className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium">I'm done — go to home</div>
            <div className="text-xs text-muted-foreground">You can add more pets later from Settings → Pets</div>
          </div>
        </Card>
      </div>

      <Button variant="ghost" onClick={() => nav("/", { replace: true })} className="w-full mt-6 text-muted-foreground">
        Skip
      </Button>
    </div>
  );
}
