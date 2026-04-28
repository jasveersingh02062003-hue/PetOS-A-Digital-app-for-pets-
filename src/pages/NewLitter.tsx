import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Sparkles, Heart, PawPrint } from "lucide-react";
import { toast } from "sonner";

type Pet = {
  id: string;
  name: string | null;
  breed: string | null;
  gender: "male" | "female" | null;
  avatar_url: string | null;
  date_of_birth: string | null;
};

type Pup = {
  tempId: string;
  name: string;
  gender: "male" | "female";
  avatar_url: string | null;
};

const Step = ({ n, active, label }: { n: number; active: boolean; label: string }) => (
  <div className={`flex items-center gap-2 text-xs ${active ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
    <div className={`h-6 w-6 rounded-full grid place-items-center ${active ? "bg-coral text-white" : "bg-muted"}`}>{n}</div>
    {label}
  </div>
);

const NewLitter = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [damId, setDamId] = useState<string | null>(null);
  const [sireId, setSireId] = useState<string | null>(null);
  const [sireExternalName, setSireExternalName] = useState("");
  const [sireMode, setSireMode] = useState<"mine" | "external">("mine");
  const [birthDate, setBirthDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [pups, setPups] = useState<Pup[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const { data: myPets } = useQuery({
    queryKey: ["my-pets-for-litter", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("pets")
        .select("id, name, breed, gender, avatar_url, date_of_birth")
        .eq("owner_id", user!.id)
        .order("name");
      return (data ?? []) as Pet[];
    },
  });

  const dams = (myPets ?? []).filter((p) => p.gender === "female");
  const sires = (myPets ?? []).filter((p) => p.gender === "male");
  const dam = dams.find((p) => p.id === damId);
  const sire = sires.find((p) => p.id === sireId);

  const addPup = () =>
    setPups((prev) => [
      ...prev,
      { tempId: crypto.randomUUID(), name: "", gender: "male", avatar_url: null },
    ]);

  const updatePup = (tempId: string, patch: Partial<Pup>) =>
    setPups((prev) => prev.map((p) => (p.tempId === tempId ? { ...p, ...patch } : p)));

  const removePup = (tempId: string) => setPups((prev) => prev.filter((p) => p.tempId !== tempId));

  const uploadAvatar = async (file: File): Promise<string | null> => {
    if (!user?.id) return null;
    const path = `${user.id}/litter-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) {
      toast.error(error.message);
      return null;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl;
  };

  const submit = async () => {
    if (!user?.id || !damId) return;
    if (pups.length === 0) {
      toast.error("Add at least one puppy");
      return;
    }
    if (pups.some((p) => !p.name.trim())) {
      toast.error("All pups need a name");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Create litter group
      const { data: litter, error: lErr } = await supabase
        .from("litter_groups")
        .insert({
          created_by: user.id,
          dam_pet_id: damId,
          sire_pet_id: sireMode === "mine" ? sireId : null,
          birth_date: birthDate,
          notes: notes || (sireMode === "external" && sireExternalName ? `Sire (off-platform): ${sireExternalName}` : null),
        } as any)
        .select("id")
        .single();
      if (lErr || !litter) throw lErr ?? new Error("Could not create litter");

      // 2. Create pup pets
      const damBreed = dam?.breed ?? null;
      const pupRows = pups.map((p) => ({
        owner_id: user.id,
        name: p.name.trim(),
        gender: p.gender,
        breed: damBreed,
        species: "dog" as any,
        date_of_birth: birthDate,
        avatar_url: p.avatar_url,
        sire_pet_id: sireMode === "mine" ? sireId : null,
        dam_pet_id: damId,
      }));
      const { data: createdPups, error: pErr } = await supabase
        .from("pets")
        .insert(pupRows as any)
        .select("id");
      if (pErr || !createdPups) throw pErr ?? new Error("Could not create pups");

      // 3. Link to litter_pets
      const links = createdPups.map((cp: any) => ({ litter_id: litter.id, pet_id: cp.id }));
      const { error: linkErr } = await supabase.from("litter_pets" as any).insert(links);
      if (linkErr) throw linkErr;

      toast.success(`Litter created — ${pups.length} pups now show "Bred on PetOS"`);
      nav("/profile");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create litter");
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-add one pup when entering step 3
  useEffect(() => {
    if (step === 3 && pups.length === 0) addPup();
  }, [step]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline px-4 py-3 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-lg flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-coral" /> New Litter
          </h1>
          <p className="text-[11px] text-muted-foreground">Each pup will be auto-tagged "Bred on PetOS"</p>
        </div>
      </header>

      <div className="px-4 py-3 flex items-center gap-3 border-b border-hairline overflow-x-auto">
        <Step n={1} active={step === 1} label="Dam" />
        <div className="h-px w-6 bg-hairline" />
        <Step n={2} active={step === 2} label="Sire" />
        <div className="h-px w-6 bg-hairline" />
        <Step n={3} active={step === 3} label="Pups" />
        <div className="h-px w-6 bg-hairline" />
        <Step n={4} active={step === 4} label="Review" />
      </div>

      <div className="p-4 space-y-3">
        {step === 1 && (
          <Card className="rounded-2xl border-hairline p-4">
            <h2 className="font-display text-base mb-1">Pick the mother (dam)</h2>
            <p className="text-xs text-muted-foreground mb-3">Choose one of your female pets. The pups inherit her breed by default.</p>
            {dams.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                You don't have any female pets registered yet.
                <div className="mt-2">
                  <Button variant="outline" size="sm" onClick={() => nav("/settings/pet/new")}>Add a pet</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {dams.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setDamId(p.id)}
                    className={`w-full flex items-center gap-3 p-2 rounded-xl border transition-colors ${
                      damId === p.id ? "border-coral bg-coral/5" : "border-hairline hover:bg-muted/30"
                    }`}
                  >
                    <div className="h-10 w-10 rounded-full bg-muted overflow-hidden">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt={p.name ?? ""} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-coral">{p.name?.[0] ?? "?"}</div>
                      )}
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-medium text-sm">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground">{p.breed ?? "Unknown breed"}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}

        {step === 2 && (
          <Card className="rounded-2xl border-hairline p-4">
            <h2 className="font-display text-base mb-1">Pick the father (sire)</h2>
            <p className="text-xs text-muted-foreground mb-3">If the sire is on PetOS, the pups get verified lineage and the "Bred on PetOS" badge.</p>
            <div className="flex gap-2 mb-3">
              <Button variant={sireMode === "mine" ? "default" : "outline"} size="sm" onClick={() => setSireMode("mine")}>
                My pets
              </Button>
              <Button variant={sireMode === "external" ? "default" : "outline"} size="sm" onClick={() => { setSireMode("external"); setSireId(null); }}>
                Off-platform
              </Button>
            </div>
            {sireMode === "mine" ? (
              sires.length === 0 ? (
                <div className="text-xs text-muted-foreground py-3">
                  You don't have any male pets. Switch to "Off-platform" to record an external sire.
                </div>
              ) : (
                <div className="space-y-2">
                  {sires.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSireId(p.id)}
                      className={`w-full flex items-center gap-3 p-2 rounded-xl border transition-colors ${
                        sireId === p.id ? "border-sky bg-sky/5" : "border-hairline hover:bg-muted/30"
                      }`}
                    >
                      <div className="h-10 w-10 rounded-full bg-muted overflow-hidden">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt={p.name ?? ""} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full grid place-items-center text-sky">{p.name?.[0] ?? "?"}</div>
                        )}
                      </div>
                      <div className="text-left flex-1">
                        <div className="font-medium text-sm">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground">{p.breed ?? "Unknown breed"}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )
            ) : (
              <div>
                <Label className="text-xs">Sire name (off-platform)</Label>
                <Input
                  value={sireExternalName}
                  onChange={(e) => setSireExternalName(e.target.value)}
                  placeholder="e.g. Bruno (Mr. Sharma's dog)"
                />
                <p className="text-[11px] text-muted-foreground mt-2">
                  Pups will be tracked but won't get the "Bred on PetOS" verified-lineage badge.
                </p>
              </div>
            )}
          </Card>
        )}

        {step === 3 && (
          <Card className="rounded-2xl border-hairline p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-display text-base">Add pups</h2>
                <p className="text-xs text-muted-foreground">One row per puppy.</p>
              </div>
              <Button size="sm" variant="outline" onClick={addPup}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add pup
              </Button>
            </div>
            <div className="mb-3">
              <Label className="text-xs">Birth date</Label>
              <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
            <div className="space-y-3">
              {pups.map((p, i) => (
                <div key={p.tempId} className="flex items-end gap-2 p-2 rounded-xl bg-muted/30">
                  <div className="relative">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const url = await uploadAvatar(f);
                          if (url) updatePup(p.tempId, { avatar_url: url });
                        }}
                      />
                      <div className="h-12 w-12 rounded-full bg-background border border-hairline overflow-hidden grid place-items-center">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <PawPrint className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </label>
                  </div>
                  <div className="flex-1">
                    <Label className="text-[10px]">Pup {i + 1} name</Label>
                    <Input
                      value={p.name}
                      onChange={(e) => updatePup(p.tempId, { name: e.target.value })}
                      placeholder="e.g. Coco"
                    />
                  </div>
                  <div className="w-24">
                    <Label className="text-[10px]">Gender</Label>
                    <Select value={p.gender} onValueChange={(v) => updatePup(p.tempId, { gender: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removePup(p.tempId)} className="text-muted-foreground">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Label className="text-xs">Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. healthy litter, all weighed at 350g" />
            </div>
          </Card>
        )}

        {step === 4 && (
          <Card className="rounded-2xl border-hairline p-4 space-y-4">
            <h2 className="font-display text-base">Review</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-muted/30">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Dam</div>
                <div className="font-medium text-sm">{dam?.name ?? "—"}</div>
                <div className="text-[11px] text-muted-foreground">{dam?.breed ?? "—"}</div>
              </div>
              <div className="p-3 rounded-xl bg-muted/30">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Sire</div>
                <div className="font-medium text-sm">
                  {sireMode === "mine" ? (sire?.name ?? "—") : (sireExternalName || "Off-platform")}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {sireMode === "mine" ? sire?.breed ?? "—" : "Off-platform"}
                </div>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{pups.length} Pup(s) — born {birthDate}</div>
              <div className="space-y-1.5">
                {pups.map((p) => (
                  <div key={p.tempId} className="flex items-center gap-2 text-sm">
                    <div className="h-7 w-7 rounded-full bg-muted overflow-hidden grid place-items-center">
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : <PawPrint className="h-3 w-3" />}
                    </div>
                    <span className="font-medium">{p.name || "Unnamed"}</span>
                    <span className="text-xs text-muted-foreground">· {p.gender}</span>
                  </div>
                ))}
              </div>
            </div>
            {sireMode === "mine" && sireId && damId && (
              <div className="rounded-xl bg-coral/5 border border-coral/20 p-3 flex items-start gap-2">
                <Heart className="h-4 w-4 text-coral mt-0.5 flex-shrink-0" />
                <div className="text-xs">
                  Both parents are on PetOS — every pup will display the <strong>Bred on PetOS</strong> ribbon and verified lineage.
                </div>
              </div>
            )}
          </Card>
        )}

        <div className="flex gap-2 pt-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">Back</Button>
          )}
          {step < 4 && (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={
                (step === 1 && !damId) ||
                (step === 2 && sireMode === "mine" && !sireId) ||
                (step === 3 && pups.length === 0)
              }
              className="flex-1"
            >
              Continue
            </Button>
          )}
          {step === 4 && (
            <Button onClick={submit} disabled={submitting} className="flex-1">
              {submitting ? "Creating…" : "Create litter"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewLitter;