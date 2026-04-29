import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface ExhibitSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExhibitSheet({ open, onOpenChange }: ExhibitSheetProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [habitat, setHabitat] = useState("");
  const [description, setDescription] = useState("");
  const [onDisplay, setOnDisplay] = useState(true);

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!name.trim()) throw new Error("Name is required");
      const { error } = await supabase.from("exhibits").insert({
        zoo_user_id: user.id,
        name: name.trim(),
        species: species.trim() || null,
        habitat: habitat.trim() || null,
        description: description.trim() || null,
        on_display: onDisplay,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exhibit added");
      qc.invalidateQueries({ queryKey: ["zoo-exhibits"] });
      setName("");
      setSpecies("");
      setHabitat("");
      setDescription("");
      setOnDisplay(true);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Could not save exhibit"),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Add exhibit</SheetTitle>
          <SheetDescription>Animals visible on your zoo profile.</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 mt-4">
          <div className="space-y-1.5">
            <Label htmlFor="ex-name">Name</Label>
            <Input id="ex-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bengal Tiger enclosure" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ex-species">Species</Label>
              <Input id="ex-species" value={species} onChange={(e) => setSpecies(e.target.value)} placeholder="Panthera tigris" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-habitat">Habitat</Label>
              <Input id="ex-habitat" value={habitat} onChange={(e) => setHabitat(e.target.value)} placeholder="Grassland" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ex-desc">Description</Label>
            <Textarea id="ex-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-xl border-hairline border p-3">
            <div>
              <div className="text-sm font-medium">On display</div>
              <div className="text-xs text-muted-foreground">Visible to public visitors</div>
            </div>
            <Switch checked={onDisplay} onCheckedChange={setOnDisplay} />
          </div>
          <Button className="w-full rounded-full" onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Add exhibit"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}