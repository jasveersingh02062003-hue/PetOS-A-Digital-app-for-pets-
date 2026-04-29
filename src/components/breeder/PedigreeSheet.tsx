import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ScrollText } from "lucide-react";

interface PedigreeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select a pet (e.g. opened from a pet profile). */
  initialPetId?: string;
}

export function PedigreeSheet({ open, onOpenChange, initialPetId }: PedigreeSheetProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [petId, setPetId] = useState<string>(initialPetId ?? "");
  const [registry, setRegistry] = useState("");
  const [breed, setBreed] = useState("");
  const [sireName, setSireName] = useState("");
  const [damName, setDamName] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (initialPetId) setPetId(initialPetId);
  }, [initialPetId]);

  const myPets = useQuery({
    queryKey: ["pedigree-my-pets", user?.id],
    enabled: !!user?.id && open && !initialPetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("id, name, breed")
        .eq("owner_id", user!.id)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const issue = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!petId) throw new Error("Choose a pet");
      const { data, error } = await supabase
        .from("pedigree_certificates")
        .insert({
          pet_id: petId,
          issued_by: user.id,
          certificate_number: "",
          registry_name: registry.trim() || null,
          breed: breed.trim() || null,
          sire_name: sireName.trim() || null,
          dam_name: damName.trim() || null,
          notes: notes.trim() || null,
        })
        .select("certificate_number")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Certificate issued: ${data?.certificate_number}`);
      qc.invalidateQueries({ queryKey: ["pedigree-certificates"] });
      qc.invalidateQueries({ queryKey: ["breeder-certificates"] });
      setRegistry("");
      setBreed("");
      setSireName("");
      setDamName("");
      setNotes("");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Could not issue certificate"),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" /> Issue pedigree certificate
          </SheetTitle>
          <SheetDescription>
            Recorded permanently. A unique certificate number is generated automatically.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 mt-4">
          {!initialPetId && (
            <div className="space-y-1.5">
              <Label>Pet</Label>
              <Select value={petId} onValueChange={setPetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select pet" />
                </SelectTrigger>
                <SelectContent>
                  {myPets.data?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.breed ? `· ${p.breed}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ped-registry">Registry</Label>
              <Input id="ped-registry" value={registry} onChange={(e) => setRegistry(e.target.value)} placeholder="KCI / FCI" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ped-breed">Breed</Label>
              <Input id="ped-breed" value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="Labrador" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ped-sire">Sire</Label>
              <Input id="ped-sire" value={sireName} onChange={(e) => setSireName(e.target.value)} placeholder="Sire's name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ped-dam">Dam</Label>
              <Input id="ped-dam" value={damName} onChange={(e) => setDamName(e.target.value)} placeholder="Dam's name" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ped-notes">Notes</Label>
            <Textarea id="ped-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button
            className="w-full rounded-full"
            onClick={() => issue.mutate()}
            disabled={issue.isPending || !petId}
          >
            {issue.isPending ? "Issuing…" : "Issue certificate"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}