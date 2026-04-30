import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowLeft, PawPrint } from "lucide-react";
import { toast } from "sonner";
import { useSeo } from "@/hooks/useSeo";
import { WizardSteps } from "@/components/onboarding/WizardSteps";

/**
 * Quick-add pet flow used for additional pets after the rich first-pet wizard.
 * Captures species, breed, birthday OR adoption date, plus a health-now-or-later
 * decision. Health setup is deferred to the Health tab when the user chooses later.
 */
export default function AddFirstPet() {
  const nav = useNavigate();
  const qc = useQueryClient();
  useSeo({ title: "Add a pet", description: "Tell PetOS about your pet." });

  const [form, setForm] = useState({
    name: "",
    species: "dog",
    breed: "",
    dateMode: "dob" as "dob" | "adoption",
    dateValue: "",
    healthNow: false,
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      if (!form.name.trim()) throw new Error("Name is required");
      const payload: any = {
        owner_id: u.user.id,
        name: form.name.trim(),
        species: form.species,
        breed: form.breed || null,
        health_setup_complete: false,
      };
      if (form.dateValue) {
        if (form.dateMode === "dob") payload.date_of_birth = form.dateValue;
        else payload.adoption_date = form.dateValue;
      }
      const { data, error } = await supabase.from("pets").insert(payload).select("id").single();
      if (error) throw error;
      return data?.id as string;
    },
    onSuccess: (petId) => {
      qc.invalidateQueries({ queryKey: ["pets"] });
      toast.success("Pet added");
      // If they want to set up health now, jump straight into Health tab; the
      // missing-health card there opens the proper editor.
      if (form.healthNow) nav("/health");
      else nav("/onboarding/add-another-pet");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not add pet"),
  });

  return (
    <div className="container-app pt-4 pb-24 max-w-lg">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <WizardSteps current={2} labels={["Account type", "Add a pet", "All set"]} />

      <h1 className="font-display text-2xl mb-1 flex items-center gap-2">
        <PawPrint className="h-6 w-6 text-primary" /> Add a pet
      </h1>
      <p className="text-sm text-muted-foreground mb-5">
        Quick add — name, species, breed and either a birthday or the date you adopted them.
      </p>

      <Card className="rounded-2xl p-4 space-y-3">
        <div>
          <Label htmlFor="name">Pet name *</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Bruno"
          />
        </div>
        <div>
          <Label htmlFor="species">Species</Label>
          <select
            id="species"
            value={form.species}
            onChange={(e) => setForm({ ...form, species: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="dog">Dog</option>
            <option value="cat">Cat</option>
            <option value="bird">Bird / Parrot</option>
            <option value="rabbit">Rabbit</option>
            <option value="hamster">Hamster</option>
            <option value="horse">Horse</option>
            <option value="reptile">Reptile / Snake</option>
            <option value="fish">Fish</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <Label htmlFor="breed">Breed (optional)</Label>
          <Input
            id="breed"
            value={form.breed}
            onChange={(e) => setForm({ ...form, breed: e.target.value })}
            placeholder="e.g. Indie / Labrador"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => setForm({ ...form, dateMode: "dob" })}
            className={`rounded-xl border px-3 py-2 text-sm transition ${
              form.dateMode === "dob" ? "border-primary bg-primary/5" : "border-hairline"
            }`}
          >
            Birthday
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, dateMode: "adoption" })}
            className={`rounded-xl border px-3 py-2 text-sm transition ${
              form.dateMode === "adoption" ? "border-primary bg-primary/5" : "border-hairline"
            }`}
          >
            Adoption date
          </button>
        </div>
        <Input
          type="date"
          value={form.dateValue}
          onChange={(e) => setForm({ ...form, dateValue: e.target.value })}
        />

        <div className="rounded-xl border border-hairline p-3">
          <div className="text-sm font-medium mb-2">Set up health now?</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, healthNow: true })}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                form.healthNow ? "border-primary bg-primary/5" : "border-hairline text-muted-foreground"
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, healthNow: false })}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                !form.healthNow ? "border-primary bg-primary/5" : "border-hairline text-muted-foreground"
              }`}
            >
              I'll do it later
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            If later, we'll show a "Set up health" card on Home and in the Health tab.
          </p>
        </div>
      </Card>

      <div className="flex gap-2 mt-4">
        <Button onClick={() => create.mutate()} disabled={create.isPending} className="flex-1">
          {create.isPending ? "Saving…" : "Add pet & continue"}
        </Button>
        <Button variant="outline" onClick={() => nav("/onboarding/done")}>
          Skip
        </Button>
      </div>
    </div>
  );
}
