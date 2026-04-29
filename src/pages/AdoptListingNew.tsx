import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Loader2, Upload, ShieldAlert, BadgeCheck, Heart, Home as HomeIcon } from "lucide-react";
import { toast } from "sonner";
import { useSeo } from "@/hooks/useSeo";
import { HealthTestPicker } from "@/components/marketplace/HealthTestPicker";
import type { HealthTestEntry } from "@/lib/healthTests";
import { CoListShelterPicker, type CoListShelter } from "@/components/marketplace/CoListShelterPicker";

type ListingType = "adoption" | "rehoming" | "breeder_sale";

const AdoptListingNew = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [type, setType] = useState<ListingType>("adoption");
  const [breederVerified, setBreederVerified] = useState(false);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [ownOrgApproved, setOwnOrgApproved] = useState(false);
  const [coListShelter, setCoListShelter] = useState<CoListShelter | null>(null);

  const [title, setTitle] = useState("");
  const [species, setSpecies] = useState("dog");
  const [breed, setBreed] = useState("");
  const [gender, setGender] = useState<string>("");
  const [ageWeeks, setAgeWeeks] = useState<string>("");
  const [city, setCity] = useState("");
  const [fee, setFee] = useState("");
  const [description, setDescription] = useState("");
  const [microchip, setMicrochip] = useState("");
  const [parentsInfo, setParentsInfo] = useState("");
  const [healthTests, setHealthTests] = useState<HealthTestEntry[]>([]);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [vaxDocUrl, setVaxDocUrl] = useState<string | null>(null);
  const [breederCertUrl, setBreederCertUrl] = useState<string | null>(null);

  const [uploading, setUploading] = useState<"photo" | "vax" | "cert" | null>(null);
  const [saving, setSaving] = useState(false);

  const photoRef = useRef<HTMLInputElement>(null);
  const vaxRef = useRef<HTMLInputElement>(null);
  const certRef = useRef<HTMLInputElement>(null);

  useSeo({ title: "List a pet for adoption", description: "Help a pet find a loving new home." });

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("breeder_verified, breeder_cert_url, city, account_type").eq("id", user.id).maybeSingle();
      setBreederVerified(!!data?.breeder_verified);
      setAccountType((data as any)?.account_type ?? null);
      if (data?.city && !city) setCity(data.city);
      const { data: org } = await supabase.from("org_profiles").select("status").eq("user_id", user.id).maybeSingle();
      setOwnOrgApproved((org as any)?.status === "approved");
    })();
  }, [user]);

  const isUnverifiedRescuer = accountType === "rescuer" && !ownOrgApproved;

  const upload = async (file: File, kind: "photo" | "vax" | "cert") => {
    if (!user) { toast.error("Sign in first"); return null; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Max 8MB"); return null; }
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("pet-listings").upload(path, file, {
        upsert: false,
        contentType: file.type,
        cacheControl: "31536000",
      });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("pet-listings").getPublicUrl(path);
      return publicUrl;
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
      return null;
    } finally {
      setUploading(null);
    }
  };

  const submit = async () => {
    if (!user) return toast.error("Sign in first");
    if (!title.trim()) return toast.error("Add a title");
    const aw = Number(ageWeeks);
    if (!aw || aw < 8) return toast.error("Pet must be at least 8 weeks old");
    if (!vaxDocUrl) return toast.error("Vaccination record is required");
    if (type === "breeder_sale" && !breederVerified) return toast.error("Only verified breeders can list breeder sales. Apply in Settings.");
    if (type === "breeder_sale" && !breederCertUrl) return toast.error("Attach breeder certificate");
    if (isUnverifiedRescuer && !coListShelter) {
      return toast.error("Select an approved shelter to co-list with.");
    }
    setSaving(true);
    const { error } = await supabase.from("pet_listings").insert({
      owner_id: user.id,
      listing_type: type,
      title: title.trim(),
      species,
      breed: breed.trim() || null,
      gender: gender || null,
      age_weeks: aw,
      city: city.trim() || null,
      fee_inr: type === "adoption" ? null : (fee ? Number(fee) : null),
      description: description.trim() || null,
      microchip_id: microchip.trim() || null,
      parents_info: parentsInfo.trim() ? { notes: parentsInfo.trim() } : null,
      vaccination_doc_url: vaxDocUrl,
      breeder_cert_url: breederCertUrl,
      health_tests: healthTests as any,
      photos: photoUrl ? [photoUrl] : [],
      co_listed_with_org_id: coListShelter?.user_id ?? null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Listing posted");
    nav("/mates?tab=adopt");
  };

  return (
    <div className="container-app pt-6 pb-32 max-w-lg">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="font-display text-2xl mb-1">List a pet</h1>
      <p className="text-sm text-muted-foreground mb-5">Step {step} of 3</p>

      {step === 1 && (
        <Card className="rounded-2xl border-hairline p-4 space-y-3">
          <Label>Listing type</Label>
          <button onClick={() => setType("adoption")} className={`w-full text-left rounded-xl border p-3 flex gap-3 items-start ${type === "adoption" ? "border-leaf bg-leaf/5" : "border-hairline"}`}>
            <Heart className="h-5 w-5 text-leaf shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-sm">Adoption (free)</div>
              <div className="text-xs text-muted-foreground">Rescue or rehoming with no fee. Always free for the new family.</div>
            </div>
          </button>
          <button onClick={() => setType("rehoming")} className={`w-full text-left rounded-xl border p-3 flex gap-3 items-start ${type === "rehoming" ? "border-coral bg-coral/5" : "border-hairline"}`}>
            <HomeIcon className="h-5 w-5 text-coral shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-sm">Rehoming (small fee)</div>
              <div className="text-xs text-muted-foreground">Owner can no longer keep the pet. A token fee helps screen serious adopters.</div>
            </div>
          </button>
          <button
            onClick={() => breederVerified ? setType("breeder_sale") : toast.info("Apply for breeder verification in Settings to enable this option")}
            className={`w-full text-left rounded-xl border p-3 flex gap-3 items-start ${type === "breeder_sale" ? "border-sky bg-sky/5" : "border-hairline"} ${!breederVerified ? "opacity-60" : ""}`}
          >
            <BadgeCheck className="h-5 w-5 text-sky shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-sm flex items-center gap-1">Breeder sale {!breederVerified && <span className="text-[10px] font-normal text-muted-foreground">(verification required)</span>}</div>
              <div className="text-xs text-muted-foreground">Only registered breeders. Requires certificate, parents info, microchip.</div>
            </div>
          </button>

          <Card className="rounded-xl bg-amber-500/10 border-amber-500/30 p-3 mt-2 flex gap-2 text-[12px] leading-relaxed">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span>By listing, you confirm the pet is healthy, at least 8 weeks old, and vaccinated. False listings will be removed.</span>
          </Card>

          <Button onClick={() => setStep(2)} className="w-full rounded-xl h-11 mt-2">Continue</Button>
        </Card>
      )}

      {step === 2 && (
        <Card className="rounded-2xl border-hairline p-4 space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Friendly Labrador needs a home" maxLength={80} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Species</Label>
              <Select value={species} onValueChange={setSpecies}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dog">Dog</SelectItem>
                  <SelectItem value="cat">Cat</SelectItem>
                  <SelectItem value="bird">Bird</SelectItem>
                  <SelectItem value="rabbit">Rabbit</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Breed</Label>
              <Input value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="Mixed" />
            </div>
            <div>
              <Label>Age (weeks)</Label>
              <Input type="number" min={8} value={ageWeeks} onChange={(e) => setAgeWeeks(e.target.value)} placeholder="12" />
            </div>
          </div>
          <div>
            <Label>City</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Mumbai" />
          </div>
          {type !== "adoption" && (
            <div>
              <Label>{type === "rehoming" ? "Token fee (₹, optional)" : "Fee (₹)"}</Label>
              <Input type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} placeholder={type === "rehoming" ? "0 – 2000" : "Sale price"} />
            </div>
          )}
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Temperament, why rehoming, what kind of home you're looking for…" maxLength={800} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1 rounded-xl h-11">Back</Button>
            <Button onClick={() => setStep(3)} className="flex-1 rounded-xl h-11">Continue</Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="rounded-2xl border-hairline p-4 space-y-4">
          {isUnverifiedRescuer && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Co-list with shelter <span className="text-coral">*</span>
              </Label>
              <p className="text-[11px] text-muted-foreground -mt-1">
                Independent rescuers must co-list with an approved shelter for buyer safety. Pick one to continue.
              </p>
              <CoListShelterPicker value={coListShelter} onChange={setCoListShelter} />
            </div>
          )}
          <div>
            <Label>Pet photo</Label>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              const url = await upload(f, "photo"); if (url) setPhotoUrl(url);
            }} />
            <button onClick={() => photoRef.current?.click()} className="mt-2 w-full rounded-xl border border-dashed border-hairline h-32 flex items-center justify-center bg-muted/30 overflow-hidden">
              {uploading === "photo" ? <Loader2 className="h-5 w-5 animate-spin" /> :
                photoUrl ? <img src={photoUrl} alt="" className="w-full h-full object-cover" /> :
                <span className="flex items-center gap-2 text-sm text-muted-foreground"><Upload className="h-4 w-4" /> Add photo</span>}
            </button>
          </div>

          <div>
            <Label>Vaccination record <span className="text-coral">*</span></Label>
            <input ref={vaxRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              const url = await upload(f, "vax"); if (url) setVaxDocUrl(url);
            }} />
            <button onClick={() => vaxRef.current?.click()} className="mt-2 w-full rounded-xl border border-dashed border-hairline h-14 flex items-center justify-center bg-muted/30 px-3">
              {uploading === "vax" ? <Loader2 className="h-5 w-5 animate-spin" /> :
                vaxDocUrl ? <span className="text-sm text-leaf font-medium">Uploaded ✓ Tap to replace</span> :
                <span className="flex items-center gap-2 text-sm text-muted-foreground"><Upload className="h-4 w-4" /> Upload vaccination certificate</span>}
            </button>
          </div>

          {type === "breeder_sale" && (
            <>
              <div>
                <Label>Breeder certificate <span className="text-coral">*</span></Label>
                <input ref={certRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const url = await upload(f, "cert"); if (url) setBreederCertUrl(url);
                }} />
                <button onClick={() => certRef.current?.click()} className="mt-2 w-full rounded-xl border border-dashed border-hairline h-14 flex items-center justify-center bg-muted/30 px-3">
                  {uploading === "cert" ? <Loader2 className="h-5 w-5 animate-spin" /> :
                    breederCertUrl ? <span className="text-sm text-leaf font-medium">Uploaded ✓ Tap to replace</span> :
                    <span className="flex items-center gap-2 text-sm text-muted-foreground"><Upload className="h-4 w-4" /> Upload breeder certificate</span>}
                </button>
              </div>
              <div>
                <Label>Microchip ID</Label>
                <Input value={microchip} onChange={(e) => setMicrochip(e.target.value)} placeholder="15-digit microchip number" />
              </div>
              <div>
                <Label>Parents info</Label>
                <Textarea value={parentsInfo} onChange={(e) => setParentsInfo(e.target.value)} rows={2} placeholder="Sire, dam, lineage details" />
              </div>
              <div>
                <Label>Health screening tests</Label>
                <div className="mt-2">
                  <HealthTestPicker
                    species={species}
                    value={healthTests}
                    onChange={setHealthTests}
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1 rounded-xl h-11">Back</Button>
            <Button onClick={submit} disabled={saving} className="flex-1 rounded-xl h-11">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post listing"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AdoptListingNew;