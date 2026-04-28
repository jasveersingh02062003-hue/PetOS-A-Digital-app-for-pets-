import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
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
 * Step 2 (for pet parents / rescuers): add your first pet.
 * Step 2 for org types is OrgOnboarding instead.
 */
export default function AddFirstPet() {
  const nav = useNavigate();
  useSeo({ title: "Add your first pet", description: "Tell PetOS about your pet." });

  const [form, setForm] = useState({
    name: "",
    species: "dog",
    breed: "",
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      if (!form.name.trim()) throw new Error("Name is required");
      const { error } = await supabase.from("pets").insert({
        owner_id: u.user.id,
        name: form.name.trim(),
        species: form.species,
        breed: form.breed || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pet added");
      nav("/onboarding/done");
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
        <PawPrint className="h-6 w-6 text-primary" /> Add your first pet
      </h1>
      <p className="text-sm text-muted-foreground mb-5">
        You can add more later, or skip if you don't have a pet yet.
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
            <option value="bird">Bird</option>
            <option value="rabbit">Rabbit</option>
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