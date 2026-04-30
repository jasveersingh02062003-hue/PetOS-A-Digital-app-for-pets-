import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Stethoscope, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const SPECIALIZATIONS = [
  "General practice",
  "Surgery",
  "Dermatology",
  "Dentistry",
  "Cardiology",
  "Behaviour",
  "Exotic / avian",
  "Emergency & critical",
];

const VetOnboarding = () => {
  const nav = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const [clinic, setClinic] = useState("");
  const [city, setCity] = useState("");
  const [license, setLicense] = useState("");
  const [yearsExp, setYearsExp] = useState("");
  const [bio, setBio] = useState("");
  const [specs, setSpecs] = useState<string[]>([]);
  const [feeChat, setFeeChat] = useState("");
  const [feeVideo, setFeeVideo] = useState("");
  const [feeClinic, setFeeClinic] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: existing, refetch } = useQuery({
    queryKey: ["vet-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vet_profiles" as any)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!user,
  });

  const toggleSpec = (s: string) =>
    setSpecs((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  const submit = async () => {
    if (!user) return;
    if (!displayName || !license || !clinic) {
      return toast.error("Name, clinic and license are required");
    }
    setSaving(true);
    const { error } = await supabase.from("vet_profiles" as any).upsert({
      user_id: user.id,
      display_name: displayName,
      clinic_name: clinic,
      license_number: license,
      city: city || null,
      bio: bio || null,
      year_qualified: yearsExp ? new Date().getFullYear() - parseInt(yearsExp) : null,
      specialisations: specs,
      price_chat_inr: feeChat ? parseInt(feeChat) : 0,
      price_video_inr: feeVideo ? parseInt(feeVideo) : 0,
      price_clinic_inr: feeClinic ? parseInt(feeClinic) : 0,
      onboarded: true,
    }, { onConflict: "user_id" });
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }
    const { error: profErr } = await supabase
      .from("profiles")
      .update({ onboarded: true } as any)
      .eq("id", user.id);
    setSaving(false);
    if (profErr) toast.error(profErr.message);
    toast.success("Vet profile saved");
    refetch();
    nav("/vet");
  };

  if (existing) {
    return (
      <div className="container-app pad-top-safe pb-24">
        <header className="pt-4 pb-4 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-display text-xl">Vet profile</h1>
        </header>
        <Card className="rounded-2xl border-hairline p-6 text-center space-y-3">
          <CheckCircle2 className="h-10 w-10 mx-auto text-primary" strokeWidth={1.5} />
          <div className="font-display text-lg">{existing.display_name}</div>
          <p className="text-sm text-muted-foreground">{existing.clinic_name} · {existing.city || "—"}</p>
          <Button onClick={() => nav("/vet")} className="rounded-full">Open dashboard</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container-app pad-top-safe pb-24">
      <header className="pt-4 pb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-xl">Vet onboarding</h1>
        <span className="ml-auto text-xs text-muted-foreground">Step {step}/3</span>
      </header>

      <Card className="rounded-2xl border-hairline p-5 space-y-4">
        {step === 1 && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              <h2 className="font-display text-base">Credentials</h2>
            </div>
            <div className="space-y-1.5">
              <Label>Display name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Dr. Priya Sharma" />
            </div>
            <div className="space-y-1.5">
              <Label>Clinic name</Label>
              <Input value={clinic} onChange={(e) => setClinic(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>License number</Label>
              <Input value={license} onChange={(e) => setLicense(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Years exp.</Label>
                <Input type="number" value={yearsExp} onChange={(e) => setYearsExp(e.target.value)} />
              </div>
            </div>
            <Button className="w-full rounded-full h-12" onClick={() => setStep(2)}>
              Next
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="font-display text-base">Specializations</h2>
            <div className="flex flex-wrap gap-2">
              {SPECIALIZATIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSpec(s)}
                  className={`text-xs rounded-full px-3 py-1.5 border ${
                    specs.includes(s)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-hairline bg-background"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label>About you</Label>
              <Textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Approach, languages, special interests…" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-full h-12" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1 rounded-full h-12" onClick={() => setStep(3)}>Next</Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="font-display text-base">Consultation fees (₹)</h2>
            <p className="text-xs text-muted-foreground">Free during beta — fees show to owners but are not charged yet.</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Chat</Label>
                <Input type="number" value={feeChat} onChange={(e) => setFeeChat(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Video</Label>
                <Input type="number" value={feeVideo} onChange={(e) => setFeeVideo(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Clinic</Label>
                <Input type="number" value={feeClinic} onChange={(e) => setFeeClinic(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-full h-12" onClick={() => setStep(2)}>Back</Button>
              <Button className="flex-1 rounded-full h-12" onClick={submit} disabled={saving}>
                {saving ? "Saving…" : "Finish"}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default VetOnboarding;
