import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getCategoryMeta } from "@/lib/serviceCategories";
import { useSeo } from "@/hooks/useSeo";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SLOTS = ["Morning", "Afternoon", "Evening", "Night"];
const LANGS = ["English", "Hindi", "Tamil", "Telugu", "Bengali", "Marathi", "Kannada"];

type DocSlot = { kind: "govt_id" | "address" | "cert" | "license"; label: string; required: boolean };

const ProviderWizard = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const { category = "walking" } = useParams();
  const meta = getCategoryMeta(category) ?? getCategoryMeta("walking")!;
  useSeo({ title: `Become a ${meta.short}`, description: `Set up your ${meta.label.toLowerCase()} profile on PetOS.` });

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [radius, setRadius] = useState("5");
  const [langs, setLangs] = useState<string[]>(["English"]);
  const [days, setDays] = useState<string[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [rate, setRate] = useState("");
  const [phone, setPhone] = useState("");
  // category-specific
  const [maxDogs, setMaxDogs] = useState("3");
  const [mode, setMode] = useState<"mobile" | "salon">("mobile");
  const [capacity, setCapacity] = useState("5");
  const [vehicle, setVehicle] = useState("");
  const [hasCrate, setHasCrate] = useState(false);
  const [liveIn, setLiveIn] = useState(false);
  // docs
  const [docs, setDocs] = useState<Record<string, File | null>>({});
  const [agreed, setAgreed] = useState(false);

  const docSlots: DocSlot[] = [
    { kind: "govt_id", label: "Government ID (Aadhaar / PAN / Passport)", required: true },
    { kind: "address", label: "Address proof", required: true },
    { kind: "cert", label: "Certification (optional)", required: false },
  ];
  if (category === "pet_taxi") {
    docSlots.push({ kind: "license", label: "Driver's license", required: true });
  }

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first");
      if (!name) throw new Error("Business name is required");
      if (!city) throw new Error("City is required");
      if (!agreed) throw new Error("Please agree to the code of conduct");
      const requiredMissing = docSlots.filter((s) => s.required && !docs[s.kind]);
      if (requiredMissing.length) throw new Error(`Upload: ${requiredMissing.map((s) => s.label).join(", ")}`);

      const details: Record<string, any> = {};
      if (category === "walking") details.max_dogs_per_walk = parseInt(maxDogs) || 1;
      if (category === "grooming") details.mode = mode;
      if (category === "daycare" || category === "boarding") details.capacity = parseInt(capacity) || 1;
      if (category === "pet_taxi") { details.vehicle = vehicle; details.has_crate = hasCrate; }
      if (category === "caretaker") details.live_in = liveIn;

      const { data: created, error: insErr } = await supabase
        .from("service_providers")
        .insert({
          owner_id: user.id,
          name,
          category: category as any,
          city,
          bio: bio || null,
          hourly_rate_inr: rate ? parseInt(rate) : null,
          contact_phone: phone || null,
          service_radius_km: parseInt(radius) || 5,
          languages: langs,
          days_available: days,
          time_slots: slots,
          details,
          accepting_jobs: false,
          verification_status: "pending",
          verified: false,
        } as any)
        .select("id")
        .single();
      if (insErr) throw insErr;
      const providerId = (created as any).id as string;

      // Upload each doc to provider-docs/{user.id}/{providerId}/{kind}-{ts}.{ext}
      for (const slot of docSlots) {
        const file = docs[slot.kind];
        if (!file) continue;
        const ext = file.name.split(".").pop() || "bin";
        const path = `${user.id}/${providerId}/${slot.kind}-${Date.now()}.${ext}`;
        const up = await supabase.storage.from("provider-docs").upload(path, file, { upsert: false });
        if (up.error) throw up.error;
        const ins = await (supabase.from("provider_documents" as any) as any).insert({
          provider_id: providerId,
          owner_id: user.id,
          kind: slot.kind,
          file_path: path,
        });
        if (ins.error) throw ins.error;
      }
      return providerId;
    },
    onSuccess: () => {
      toast.success("Submitted for verification");
      nav("/provider");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not submit"),
  });

  return (
    <div className="container-app pad-top-safe pb-24 max-w-lg">
      <header className="pt-4 pb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="font-display text-xl leading-tight">Become a {meta.short.toLowerCase()}</h1>
          <div className="text-[11px] text-muted-foreground">Step {step} of 3</div>
        </div>
      </header>

      <Card className="rounded-2xl border-hairline p-5 space-y-4">
        {step === 1 && (
          <>
            <h2 className="font-display text-base">About you</h2>
            <div className="space-y-1.5">
              <Label>Business / display name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya's Pet Walks" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Service radius (km)</Label>
                <Input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Languages</Label>
              <div className="flex flex-wrap gap-1.5">
                {LANGS.map((l) => (
                  <button key={l} type="button"
                    onClick={() => toggle(langs, l, setLangs)}
                    className={`text-xs rounded-full px-3 py-1.5 border ${langs.includes(l) ? "bg-primary text-primary-foreground border-primary" : "border-hairline"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <Button className="w-full rounded-full h-12" onClick={() => setStep(2)}>Next</Button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="font-display text-base">Service details</h2>
            <div className="space-y-1.5">
              <Label>Hourly rate (₹)</Label>
              <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Days available</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d) => (
                  <button key={d} type="button"
                    onClick={() => toggle(days, d, setDays)}
                    className={`text-xs rounded-full px-3 py-1.5 border ${days.includes(d) ? "bg-primary text-primary-foreground border-primary" : "border-hairline"}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Time slots</Label>
              <div className="flex flex-wrap gap-1.5">
                {SLOTS.map((s) => (
                  <button key={s} type="button"
                    onClick={() => toggle(slots, s, setSlots)}
                    className={`text-xs rounded-full px-3 py-1.5 border ${slots.includes(s) ? "bg-primary text-primary-foreground border-primary" : "border-hairline"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {category === "walking" && (
              <div className="space-y-1.5">
                <Label>Max dogs per walk</Label>
                <Input type="number" value={maxDogs} onChange={(e) => setMaxDogs(e.target.value)} />
              </div>
            )}
            {category === "grooming" && (
              <div className="flex items-center justify-between rounded-xl border border-hairline px-3 py-2">
                <span className="text-sm">Mobile (I come to the home)</span>
                <Switch checked={mode === "mobile"} onCheckedChange={(v) => setMode(v ? "mobile" : "salon")} />
              </div>
            )}
            {(category === "daycare" || category === "boarding") && (
              <div className="space-y-1.5">
                <Label>Capacity (pets at a time)</Label>
                <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
              </div>
            )}
            {category === "pet_taxi" && (
              <>
                <div className="space-y-1.5">
                  <Label>Vehicle (e.g. Maruti Wagon-R AC)</Label>
                  <Input value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-hairline px-3 py-2">
                  <span className="text-sm">I have a pet crate</span>
                  <Switch checked={hasCrate} onCheckedChange={setHasCrate} />
                </div>
              </>
            )}
            {category === "caretaker" && (
              <div className="flex items-center justify-between rounded-xl border border-hairline px-3 py-2">
                <span className="text-sm">Live-in caretaker</span>
                <Switch checked={liveIn} onCheckedChange={setLiveIn} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>About your service</Label>
              <Textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Experience, approach, anything pet parents should know" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-full h-12" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1 rounded-full h-12" onClick={() => setStep(3)}>Next</Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="font-display text-base">Trust & verification</h2>
            <p className="text-xs text-muted-foreground">Documents are stored privately and only reviewed by our team.</p>
            <div className="space-y-2">
              {docSlots.map((s) => (
                <DocPicker key={s.kind} slot={s} file={docs[s.kind] ?? null}
                  onChange={(f) => setDocs((p) => ({ ...p, [s.kind]: f }))} />
              ))}
            </div>
            <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
              <span>I agree to PetOS code of conduct, allow background checks, and confirm my information is accurate.</span>
            </label>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-full h-12" onClick={() => setStep(2)}>Back</Button>
              <Button className="flex-1 rounded-full h-12" onClick={() => submit.mutate()} disabled={submit.isPending}>
                {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit for review"}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

const DocPicker = ({ slot, file, onChange }: { slot: DocSlot; file: File | null; onChange: (f: File | null) => void }) => {
  return (
    <div className="rounded-xl border border-hairline p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm">{slot.label}{slot.required && <span className="text-destructive ml-1">*</span>}</div>
        {file && (
          <button onClick={() => onChange(null)} className="text-xs text-muted-foreground"><X className="h-4 w-4" /></button>
        )}
      </div>
      {file ? (
        <div className="text-xs text-muted-foreground truncate">{file.name}</div>
      ) : (
        <label className="flex items-center justify-center gap-2 h-10 rounded-lg border border-dashed border-hairline cursor-pointer text-xs text-muted-foreground">
          <Upload className="h-4 w-4" /> Upload
          <input type="file" className="hidden" accept="image/*,application/pdf"
            onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
        </label>
      )}
    </div>
  );
};

export default ProviderWizard;