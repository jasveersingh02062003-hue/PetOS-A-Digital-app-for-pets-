import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PawPrint, Plus } from "lucide-react";
import { toast } from "sonner";

interface AddPetPromptProps {
  children?: React.ReactNode;
  triggerClassName?: string;
}

export function AddPetPrompt({ children, triggerClassName }: AddPetPromptProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

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
      
      const payload = {
        owner_id: u.user.id,
        name: form.name.trim(),
        species: form.species,
        breed: form.breed || null,
        health_setup_complete: false,
      };
      
      const { data, error } = await supabase.from("pets").insert(payload).select("id").single();
      if (error) throw error;
      return data?.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pets"] });
      toast.success("Pet added successfully");
      setOpen(false);
      setForm({ name: "", species: "dog", breed: "" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not add pet"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className={triggerClassName} size="sm">
            <Plus className="h-4 w-4 mr-2" /> Add a pet
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PawPrint className="h-5 w-5 text-primary" /> Add your pet
          </DialogTitle>
          <DialogDescription>
            Add a pet to unlock the Health Vault, AI Companion, and personalized recommendations.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Pet name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Bruno"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
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
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="breed">Breed (optional)</Label>
            <Input
              id="breed"
              value={form.breed}
              onChange={(e) => setForm({ ...form, breed: e.target.value })}
              placeholder="e.g. Labrador"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !form.name.trim()}>
            {create.isPending ? "Adding..." : "Add pet"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
