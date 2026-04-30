import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, PawPrint } from "lucide-react";
import { toast } from "sonner";
import { useSeo } from "@/hooks/useSeo";
import { WizardSteps } from "@/components/onboarding/WizardSteps";

/**
 * Breeder / Kennel onboarding step. Captures specialism, scale and KCI status.
 * Persists into `org_profiles.description` (JSON) so we don't need new schema.
 * After save, hands off to `/onboarding/org` for the registration document.
 */
export default function BreederProfile() {
  const nav = useNavigate();
  useSeo({
    title: "Tell us about your breeding programme",
    description: "Breeds, experience and scale help buyers find you.",
  });

  const [breeds, setBreeds] = useState("");
  const [yearsExp, setYearsExp] = useState("");
  const [pairs, setPairs] = useState("");
  const [kciMember, setKciMember] = useState(false);
  const [city, setCity] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const meta = {
        breeder: {
          breeds: breeds
            .split(",")
            .map((b) => b.trim())
            .filter(Boolean),
          years_exp: yearsExp ? parseInt(yearsExp, 10) : null,
          breeding_pairs: pairs ? parseInt(pairs, 10) : null,
          kci_member: kciMember,
        },
      };
      const payload = {
        user_id: u.user.id,
        org_type: "breeder" as const,
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
      <WizardSteps current={2} labels={["Account type", "Your programme", "Verification"]} />

      <div className="flex items-center gap-2 mb-1">
        <PawPrint className="h-5 w-5 text-primary" />
        <h1 className="font-display text-2xl">Your breeding programme</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Used to rank you in mate & adoption searches.
      </p>

      <Card className="rounded-2xl border border-hairline p-4 mb-3 space-y-3">
        <div>
          <Label htmlFor="breeds">Breeds you specialise in</Label>
          <Input
            id="breeds"
            value={breeds}
            onChange={(e) => setBreeds(e.target.value)}
            placeholder="Golden Retriever, Labrador…"
            className="mt-1"
          />
          <div className="text-xs text-muted-foreground mt-1">
            Comma-separated.
          </div>
        </div>
        <div>
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Bengaluru"
            className="mt-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="years">Years of experience</Label>
            <Input
              id="years"
              type="number"
              inputMode="numeric"
              value={yearsExp}
              onChange={(e) => setYearsExp(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="pairs">Breeding pairs</Label>
            <Input
              id="pairs"
              type="number"
              inputMode="numeric"
              value={pairs}
              onChange={(e) => setPairs(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border border-hairline p-4 mb-3 flex items-center justify-between">
        <div>
          <div className="font-medium text-sm">KCI registered</div>
          <div className="text-xs text-muted-foreground">
            Verified KCI breeders rank higher.
          </div>
        </div>
        <Switch checked={kciMember} onCheckedChange={setKciMember} />
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
