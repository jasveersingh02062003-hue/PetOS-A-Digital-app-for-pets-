import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Heart } from "lucide-react";
import { toast } from "sonner";
import { useSeo } from "@/hooks/useSeo";
import { WizardSteps } from "@/components/onboarding/WizardSteps";

const SPECIES = ["dog", "cat", "bird", "cow", "other"];

/**
 * Rescuer / Shelter onboarding step.
 * Captures capacity + service area + which species they take. Persisted in
 * `org_profiles.description` (JSON) since rescuers don't always have a
 * registered org. After save, route to `/onboarding/org` for verification.
 */
export default function RescuerProfile() {
  const nav = useNavigate();
  useSeo({
    title: "Tell us about your rescue work",
    description: "Capacity, area and species help us match urgent cases.",
  });

  const [capacity, setCapacity] = useState("");
  const [city, setCity] = useState("");
  const [radiusKm, setRadiusKm] = useState("10");
  const [species, setSpecies] = useState<string[]>([]);
  const [urgentFoster, setUrgentFoster] = useState(false);

  const toggleSpecies = (v: string) =>
    setSpecies((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const meta = {
        rescuer: {
          capacity: capacity ? parseInt(capacity, 10) : null,
          radius_km: radiusKm ? parseInt(radiusKm, 10) : null,
          species: species.length ? species : null,
          urgent_foster: urgentFoster,
        },
      };
      const payload = {
        user_id: u.user.id,
        org_type: "shelter" as const,
        org_name: "",
        city: city.trim() || null,
        description: JSON.stringify(meta),
        status: "draft" as const,
      };
      const { error } = await supabase
        .from("org_profiles")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      nav("/onboarding/org");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });

  return (
    <div className="container-app pt-4 pb-24 max-w-lg">
      <button
        onClick={() => nav(-1)}
        className="flex items-center gap-1 text-sm text-muted-foreground mb-3"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <WizardSteps current={2} labels={["Account type", "Your work", "Verification"]} />

      <div className="flex items-center gap-2 mb-1">
        <Heart className="h-5 w-5 text-primary" />
        <h1 className="font-display text-2xl">Your rescue work</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Helps us route urgent cases your way.
      </p>

      <Card className="rounded-2xl border border-hairline p-4 mb-3 space-y-3">
        <div>
          <Label htmlFor="capacity">How many animals can you house?</Label>
          <Input
            id="capacity"
            type="number"
            inputMode="numeric"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="e.g. 5"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Pune"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="radius">Service radius (km)</Label>
          <Input
            id="radius"
            type="number"
            inputMode="numeric"
            value={radiusKm}
            onChange={(e) => setRadiusKm(e.target.value)}
            className="mt-1"
          />
        </div>
      </Card>

      <Card className="rounded-2xl border border-hairline p-4 mb-3">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Species you rescue
        </Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {SPECIES.map((s) => {
            const active = species.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSpecies(s)}
                className={`px-3 h-8 rounded-full text-sm border transition capitalize ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-hairline text-foreground hover:border-foreground/30"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="rounded-2xl border border-hairline p-4 mb-3 flex items-center justify-between">
        <div>
          <div className="font-medium text-sm">Available for urgent foster</div>
          <div className="text-xs text-muted-foreground">
            We'll ping you for emergency cases nearby.
          </div>
        </div>
        <Switch checked={urgentFoster} onCheckedChange={setUrgentFoster} />
      </Card>

      <Button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="w-full rounded-2xl h-12"
      >
        {save.isPending ? "Saving…" : "Continue to verification"}
      </Button>
      <Button
        variant="ghost"
        onClick={() => nav("/onboarding/org")}
        className="w-full mt-2 text-muted-foreground"
      >
        Skip for now
      </Button>
    </div>
  );
}
