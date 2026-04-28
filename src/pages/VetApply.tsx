import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

const VetApply = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const [clinic, setClinic] = useState("");
  const [license, setLicense] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ["vet-app", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vet_applications")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const submit = async () => {
    if (!user) return toast.error("Sign in first");
    if (!clinic || !license) return toast.error("Clinic and license required");
    setSaving(true);
    const { error } = await supabase.from("vet_applications").insert({
      user_id: user.id,
      clinic_name: clinic,
      license_number: license,
      city: city || null,
      bio: bio || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Application submitted — we'll review shortly");
    nav("/profile");
  };

  return (
    <div className="container-app pad-top-safe pb-24">
      <header className="pt-4 pb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-xl">Apply as a vet</h1>
      </header>

      {existing ? (
        <Card className="rounded-2xl border-hairline p-6 text-center space-y-2">
          <Stethoscope className="h-10 w-10 mx-auto text-primary" strokeWidth={1.5} />
          <div className="font-display text-lg">Application {existing.status}</div>
          <p className="text-sm text-muted-foreground">
            {existing.status === "pending" && "We'll review your credentials and get back to you soon."}
            {existing.status === "approved" && "You're a verified vet. Open the vet dashboard."}
            {existing.status === "rejected" && (existing.reviewer_notes || "Application was not approved.")}
          </p>
          {existing.status === "approved" && (
            <Button onClick={() => nav("/vet")} className="rounded-full mt-2">
              Open dashboard
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Apply to join PetPals as a verified veterinarian. You'll get access to the consult queue and verification workflow.
          </p>
          <div className="space-y-1.5">
            <Label>Clinic name</Label>
            <Input value={clinic} onChange={(e) => setClinic(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>License number</Label>
            <Input value={license} onChange={(e) => setLicense(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>City</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>About</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} />
          </div>
          <Button onClick={submit} disabled={saving} className="w-full rounded-full h-12">
            {saving ? "Submitting…" : "Submit application"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default VetApply;
