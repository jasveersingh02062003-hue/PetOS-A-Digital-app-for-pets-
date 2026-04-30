import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
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

const LIVING = [
  { value: "apartment", label: "Apartment" },
  { value: "house_yard", label: "House w/ yard" },
  { value: "farm", label: "Farm" },
];

const EXPERIENCE = [
  { value: "first_time", label: "First-time" },
  { value: "some", label: "Some" },
  { value: "experienced", label: "Experienced" },
];

const TIME_DAILY = [
  { value: "low", label: "< 1 hr" },
  { value: "medium", label: "1–3 hrs" },
  { value: "high", label: "3+ hrs" },
];

const PURPOSE = [
  { value: "companion", label: "Companion" },
  { value: "guard", label: "Guard" },
  { value: "show", label: "Show" },
  { value: "therapy", label: "Therapy" },
];

/**
 * Step 2 for buyers — preferences ranked into listing matches.
 * Every field optional; the underlying `profiles.looking_for` JSON column
 * absorbs anything we add later without further migrations.
 */
export default function BuyerPrefs() {
  const nav = useNavigate();
  useSeo({
    title: "What pet are you looking for?",
    description: "Tell us your preferences so we can match you with the right listings.",
  });

  const [species, setSpecies] = useState<string[]>([]);
  const [breed, setBreed] = useState("");
  const [city, setCity] = useState("");
  const [budget, setBudget] = useState<[number, number]>([0, 50000]);
  const [living, setLiving] = useState<string>("");
  const [experience, setExperience] = useState<string>("");
  const [timeDaily, setTimeDaily] = useState<string>("");
  const [purpose, setPurpose] = useState<string>("");

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
        budget_min_inr: budget[0] || null,
        budget_max_inr: budget[1] || null,
        living: living || null,
        experience: experience || null,
        time_daily: timeDaily || null,
        purpose: purpose || null,
      };
      const { error } = await supabase
        .from("profiles")
        .update({ looking_for, onboarded: true } as any)
        .eq("id", u.user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Preferences saved");
      nav("/onboarding?stage=done", { replace: true });
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
      <WizardSteps current={2} labels={["Account type", "Preferences", "Browse"]} />

      <div className="flex items-center gap-2 mb-1">
        <Search className="h-5 w-5 text-primary" />
        <h1 className="font-display text-2xl">What are you looking for?</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        All optional — you can change these later.
      </p>

      <Chips
        label="Species"
        options={SPECIES}
        selected={species}
        onToggle={toggleSpecies}
      />

      <Card className="rounded-2xl border border-hairline p-4 mb-3 space-y-3">
        <div>
          <Label htmlFor="breed">Breed (optional)</Label>
          <Input
            id="breed"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            placeholder="e.g. Golden Retriever"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Mumbai"
            className="mt-1"
          />
        </div>
        <div>
          <Label>
            Budget: ₹{budget[0].toLocaleString()} – ₹{budget[1].toLocaleString()}
          </Label>
          <Slider
            min={0}
            max={200000}
            step={1000}
            value={budget}
            onValueChange={(v) => setBudget([v[0], v[1]] as [number, number])}
            className="mt-3"
          />
        </div>
      </Card>

      <SingleChips
        label="Living situation"
        options={LIVING}
        selected={living}
        onSelect={setLiving}
      />
      <SingleChips
        label="Experience"
        options={EXPERIENCE}
        selected={experience}
        onSelect={setExperience}
      />
      <SingleChips
        label="Time available daily"
        options={TIME_DAILY}
        selected={timeDaily}
        onSelect={setTimeDaily}
      />
      <SingleChips
        label="Purpose"
        options={PURPOSE}
        selected={purpose}
        onSelect={setPurpose}
      />

      <Button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="w-full rounded-2xl h-12"
      >
        {save.isPending ? "Saving…" : "Start browsing"}
      </Button>
      <Button
        variant="ghost"
        onClick={() => nav("/mates?tab=adopt")}
        className="w-full mt-2 text-muted-foreground"
      >
        Skip for now
      </Button>
    </div>
  );
}

function Chips({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <Card className="rounded-2xl border border-hairline p-4 mb-3">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="flex flex-wrap gap-2 mt-2">
        {options.map((s) => {
          const active = selected.includes(s.value);
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => onToggle(s.value)}
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
  );
}

function SingleChips({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <Card className="rounded-2xl border border-hairline p-4 mb-3">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="flex flex-wrap gap-2 mt-2">
        {options.map((s) => {
          const active = selected === s.value;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => onSelect(active ? "" : s.value)}
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
  );
}
