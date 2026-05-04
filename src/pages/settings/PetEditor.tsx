import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2 } from "lucide-react";
import { ChipGroup } from "@/components/onboarding/ChipGroup";
import { BREEDS, TEMPERAMENT_TAGS, COMMON_ALLERGIES, COMMON_CONDITIONS } from "@/lib/breeds";
import { SettingsLayout } from "./SettingsLayout";
import { useUnits } from "@/hooks/useUnits";

const PetEditor = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [pet, setPet] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { weightUnit, parseWeightToKg, kgToDisplay } = useUnits();

  useEffect(() => {
    if (!id) return;
    supabase.from("pets").select("*").eq("id", id).maybeSingle().then(({ data }) => setPet(data));
  }, [id]);

  if (!pet) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin h-5 w-5" /></div>;
  }

  const update = (patch: Partial<any>) => setPet({ ...pet, ...patch });
  const breeds = BREEDS[pet.species] ?? BREEDS.other;

  const save = async () => {
    setSaving(true);
    const willBeNeutered = !!pet.neutered;
    const { error } = await supabase.from("pets").update({
      name: pet.name, breed: pet.breed, date_of_birth: pet.date_of_birth || null,
      gender: pet.gender, weight_kg: pet.weight_kg ? Number(pet.weight_kg) : null,
      target_weight_kg: pet.target_weight_kg ? Number(pet.target_weight_kg) : null,
      neutered: pet.neutered,
      activity_level: pet.activity_level, diet_type: pet.diet_type,
      social_level: pet.social_level,
      allergies: pet.allergies ?? [], conditions: pet.conditions ?? [],
      microchip_id: pet.microchip_id?.trim() || null,
      temperament: pet.temperament ?? [],
      bio: pet.bio,
      favorite_toy: pet.favorite_toy,
      ...(willBeNeutered ? { discoverable_for_mating: false } : {}),
    }).eq("id", pet.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["pets"] });
    toast.success("Saved");
  };

  const onNeuteredChange = (v: boolean) => {
    if (v && pet.discoverable_for_mating) {
      update({ neutered: true, discoverable_for_mating: false });
      toast.message(`Mating discovery turned off because ${pet.name} is neutered.`);
    } else {
      update({ neutered: v });
    }
  };

  const remove = async () => {
    if (!confirm(`Remove ${pet.name}? This cannot be undone.`)) return;
    setRemoving(true);
    const { error } = await supabase.from("pets").delete().eq("id", pet.id);
    setRemoving(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["pets"] });
    toast.success("Removed");
    nav("/settings");
  };

  return (
    <SettingsLayout title={pet.name} subtitle={`${pet.breed ?? "—"} · ${pet.species}`} onSave={save} saving={saving}>
      <Field label="Name" value={pet.name ?? ""} onChange={(v) => update({ name: v })} />

      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Breed</Label>
        <Select value={pet.breed ?? ""} onValueChange={(v) => update({ breed: v })}>
          <SelectTrigger className="h-12 rounded-xl border-hairline bg-card"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72">{breeds.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Date of birth</Label>
          <Input type="date" value={pet.date_of_birth ?? ""} onChange={(e) => update({ date_of_birth: e.target.value })} className="h-12 rounded-xl border-hairline bg-card" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Gender</Label>
          <Select value={pet.gender ?? "male"} onValueChange={(v) => update({ gender: v })}>
            <SelectTrigger className="h-12 rounded-xl border-hairline bg-card"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label={`Weight (${weightUnit})`}
          type="number"
          value={pet.weight_kg != null && pet.weight_kg !== "" ? (kgToDisplay(Number(pet.weight_kg))?.toFixed(1) ?? "") : ""}
          onChange={(v) => update({ weight_kg: v === "" ? null : parseWeightToKg(v) })}
        />
        <Field
          label={`Target weight (${weightUnit})`}
          type="number"
          value={pet.target_weight_kg != null && pet.target_weight_kg !== "" ? (kgToDisplay(Number(pet.target_weight_kg))?.toFixed(1) ?? "") : ""}
          onChange={(v) => update({ target_weight_kg: v === "" ? null : parseWeightToKg(v) })}
        />
      </div>

      <Field label="Microchip ID" value={pet.microchip_id ?? ""} onChange={(v) => update({ microchip_id: v })} />

      <Field label="Favorite Toy" value={pet.favorite_toy ?? ""} onChange={(v) => update({ favorite_toy: v })} />

      <div className="grid grid-cols-1 gap-3">
        <label className="flex items-center justify-between bg-card border border-hairline rounded-xl px-4 h-[68px]">
          <div className="text-sm font-medium">Neutered</div>
          <Switch checked={!!pet.neutered} onCheckedChange={onNeuteredChange} />
        </label>
        <label className="flex items-start justify-between gap-3 bg-card border border-hairline rounded-xl px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">Auto-celebrate birthdays</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              Posts a "{pet.name ?? "Pet"} turned N today 🎂" milestone for you each year.
            </div>
          </div>
          <Switch
            checked={pet.auto_milestones !== false}
            onCheckedChange={(v) => update({ auto_milestones: v })}
          />
        </label>
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2 block">Activity level</Label>
        <ChipGroup columns={3} multi={false} value={[pet.activity_level ?? "medium"]} onChange={(v) => update({ activity_level: v[0] })}
          options={[
            { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" },
          ]} />
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2 block">Diet</Label>
        <ChipGroup multi={false} value={[pet.diet_type ?? "kibble"]} onChange={(v) => update({ diet_type: v[0] })}
          options={[
            { value: "kibble", label: "Kibble" }, { value: "raw", label: "Raw" },
            { value: "home", label: "Home" }, { value: "mixed", label: "Mixed" },
            { value: "prescription", label: "Prescription" },
          ]} />
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2 block">Social comfort</Label>
        <ChipGroup multi={false} value={[pet.social_level ?? "pairs"]} onChange={(v) => update({ social_level: v[0] })}
          options={[
            { value: "solo", label: "Solo" }, { value: "pairs", label: "Pairs" }, { value: "crowds", label: "Crowds" },
          ]} columns={3} />
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2 block">Allergies</Label>
        <ChipGroup options={COMMON_ALLERGIES} value={pet.allergies ?? []} onChange={(v) => update({ allergies: v })} />
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2 block">Conditions</Label>
        <ChipGroup options={COMMON_CONDITIONS} value={pet.conditions ?? []} onChange={(v) => update({ conditions: v })} />
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2 block">Temperament</Label>
        <ChipGroup options={TEMPERAMENT_TAGS} value={pet.temperament ?? []} onChange={(v) => update({ temperament: v })} columns={3} />
      </div>

      <Button variant="ghost" onClick={remove} disabled={removing} className="w-full text-destructive mt-4">
        <Trash2 className="h-4 w-4 mr-2" /> Remove pet
      </Button>
    </SettingsLayout>
  );
};

const Field = ({ label, value, onChange, type = "text" }: any) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} className="h-12 rounded-xl border-hairline bg-card" />
  </div>
);

export default PetEditor;
