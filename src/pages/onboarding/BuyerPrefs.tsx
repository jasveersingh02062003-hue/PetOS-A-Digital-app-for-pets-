import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";
import { useSeo } from "@/hooks/useSeo";
import { WizardSteps } from "@/components/onboarding/WizardSteps";

const SPECIES = [
  { value: "dog", label: "Dog" },
  { value: "cat", label: "Cat" },
  { value: "bird", label: "Bird" },
  { value: "rabbit", label: "Rabbit" },
  { value: "other", label: "Other" },
];

/**
 * Step 2 for buyers: capture their preferences so we can rank listings.
 * All fields optional — they can skip.
 */
export default function BuyerPrefs() {
  const nav = useNavigate();
  useSeo({ title: "What pet are you looking for?", description: "Tell us your preferences so we can match you with the right listings." });

  const [species, setSpecies] = useState<string[]>([]);
  const [breed, setBreed] = useState("");
  const [city, setCity] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const toggleSpecies = (v: string) =>
    setSpecies((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const looking_for: any = {
        species: species.length ? species : null,
        breed: breed.trim() || null,
        city: city.trim() || null,
        max_price_inr: maxPrice ? parseInt(maxPrice, 10) : null,
      };
      const { error } = await supabase
        .from("profiles")
        .update({ looking_for, onboarded: true } as any)
        .eq("id", u.user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Preferences saved");
      nav("/mates?tab=adopt");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });

  return (
    <div className="container-app pt-4 pb-24 max-w-lg">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <WizardSteps current={2} labels={["Account type", "Preferences", "Browse"]} />

      <div className="flex items-center gap-2 mb-1">
        <Search className="h-5 w-5 text-primary" />
        <h1 className="font-display text-2xl">What are you looking for?</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-5">All optional — you can change these later.</p>

      <Card className="rounded-2xl border border-hairline p-4 mb-3">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Species</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {SPECIES.map((s) => {
            const active = species.includes(s.value);
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => toggleSpecies(s.value)}
                className={`px-3 h-8 rounded-full text-sm border transition ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-hairline text-foreground hover:border-foreground/30"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="rounded-2xl border border-hairline p-4 mb-3 space-y-3">
        <div>
          <Label htmlFor="breed">Breed (optional)</Label>
          <Input id="breed" value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="e.g. Golden Retriever" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="city">City</Label>
          <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Mumbai" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="price">Max price (₹)</Label>
          <Input
            id="price"
            type="number"
            inputMode="numeric"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="e.g. 30000"
            className="mt-1"
          />
        </div>
      </Card>

      <Button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="w-full rounded-2xl h-12"
      >
        {save.isPending ? "Saving…" : "Start browsing"}
      </Button>
      <Button variant="ghost" onClick={() => nav("/mates?tab=adopt")} className="w-full mt-2 text-muted-foreground">
        Skip for now
      </Button>
    </div>
  );
}