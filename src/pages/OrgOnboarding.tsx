import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { useSeo } from "@/hooks/useSeo";
import { WizardSteps } from "@/components/onboarding/WizardSteps";

type AccountType = "breeder" | "kennel" | "shelter" | "sanctuary" | "zoo";

const REQUIRED_DOC: Record<AccountType, string> = {
  breeder: "KCI / breed-club registration",
  kennel: "Trade license / KCI kennel registration",
  shelter: "80G / 12A / AWBI registration",
  sanctuary: "Trust deed / society registration",
  zoo: "CZA recognition certificate",
};

const OrgOnboarding = () => {
  const nav = useNavigate();
  const qc = useQueryClient();
  useSeo({ title: "Verify your organisation", description: "Upload registration to get verified on PetOS." });

  const { data: profile } = useQuery({
    queryKey: ["profile-self"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("id, account_type").eq("id", u.user.id).maybeSingle();
      return data;
    },
  });

  const { data: existing } = useQuery({
    queryKey: ["org-self"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("org_profiles").select("*").eq("user_id", u.user.id).maybeSingle();
      return data;
    },
  });

  const orgType = (profile?.account_type as AccountType) ?? "shelter";
  const isOrg = ["breeder", "kennel", "shelter", "sanctuary", "zoo"].includes(profile?.account_type ?? "");

  const [form, setForm] = useState({
    org_name: "",
    registration_no: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    phone: "",
    website: "",
    description: "",
    donation_upi: "",
    donation_url: "",
  });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  // hydrate
  if (existing && form.org_name === "") {
    setForm({
      org_name: existing.org_name ?? "",
      registration_no: existing.registration_no ?? "",
      address: existing.address ?? "",
      city: existing.city ?? "",
      state: existing.state ?? "",
      pincode: existing.pincode ?? "",
      phone: existing.phone ?? "",
      website: existing.website ?? "",
      description: existing.description ?? "",
      donation_upi: existing.donation_upi ?? "",
      donation_url: existing.donation_url ?? "",
    });
  }

  const submit = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      if (!isOrg) throw new Error("Pick an organisation type first");
      if (!form.org_name.trim()) throw new Error("Organisation name is required");
      if (!docFile && !existing?.registration_doc_url) throw new Error("Upload your registration document");

      let docUrl = existing?.registration_doc_url ?? null;
      if (docFile) {
        const path = `${u.user.id}/registration-${Date.now()}-${docFile.name}`;
        const up = await supabase.storage.from("org-docs").upload(path, docFile, { upsert: true });
        if (up.error) throw up.error;
        docUrl = supabase.storage.from("org-docs").getPublicUrl(path).data.publicUrl;
      }

      const photoUrls: string[] = existing?.facility_photos ?? [];
      for (const f of photoFiles) {
        const path = `${u.user.id}/photo-${Date.now()}-${f.name}`;
        const up = await supabase.storage.from("org-docs").upload(path, f, { upsert: true });
        if (up.error) throw up.error;
        photoUrls.push(supabase.storage.from("org-docs").getPublicUrl(path).data.publicUrl);
      }

      const payload = {
        user_id: u.user.id,
        org_type: orgType,
        org_name: form.org_name,
        registration_no: form.registration_no || null,
        registration_doc_url: docUrl,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        pincode: form.pincode || null,
        phone: form.phone || null,
        website: form.website || null,
        description: form.description || null,
        donation_upi: form.donation_upi || null,
        donation_url: form.donation_url || null,
        facility_photos: photoUrls,
        status: "pending" as const,
      };
      const { error } = await supabase.from("org_profiles").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
      // Mark onboarding complete so PostAuth doesn't trap the user back here
      // if they close the tab before clicking the final Done button.
      await supabase.from("profiles").update({ onboarded: true } as any).eq("id", u.user.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-self"] });
      toast.success("Submitted. Our team will review within 24-48h.");
      nav("/onboarding?stage=done", { replace: true });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not submit"),
  });

  return (
    <div className="container-app pt-4 pb-24 max-w-lg">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <WizardSteps current={2} labels={["Account type", "Verification", "All set"]} />
      <h1 className="font-display text-2xl mb-1">Verify your organisation</h1>
      <p className="text-sm text-muted-foreground mb-2">
        We review every organisation manually to keep PetOS safe.
      </p>

      {!isOrg && (
        <Card className="rounded-2xl border-amber-500/30 bg-amber-500/10 p-3 text-sm mb-4">
          Pick an organisation type first.{" "}
          <button onClick={() => nav("/onboarding/account-type")} className="underline">
            Choose type
          </button>
        </Card>
      )}

      {existing?.status === "approved" && (
        <Card className="rounded-2xl border-leaf/30 bg-leaf/10 p-3 text-sm mb-4">
          ✓ Your organisation is verified.
        </Card>
      )}
      {existing?.status === "pending" && (
        <Card className="rounded-2xl border-sky/30 bg-sky/10 p-3 text-sm mb-4">
          Pending review. You can update details below.
        </Card>
      )}
      {existing?.status === "rejected" && (
        <Card className="rounded-2xl border-coral/30 bg-coral/10 p-3 text-sm mb-4">
          Rejected: {existing.rejection_reason ?? "Please update and resubmit."}
        </Card>
      )}

      <div className="space-y-3">
        <div>
          <Label>Organisation name *</Label>
          <Input value={form.org_name} onChange={(e) => setForm({ ...form, org_name: e.target.value })} />
        </div>
        <div>
          <Label>{REQUIRED_DOC[orgType] ?? "Registration"} number</Label>
          <Input value={form.registration_no} onChange={(e) => setForm({ ...form, registration_no: e.target.value })} />
        </div>
        <div>
          <Label>Upload {REQUIRED_DOC[orgType] ?? "registration"} (PDF/JPG)</Label>
          <label className="mt-1 flex items-center gap-2 rounded-xl border border-dashed border-hairline p-3 cursor-pointer">
            <Upload className="h-4 w-4" />
            <span className="text-sm text-muted-foreground flex-1 truncate">
              {docFile?.name ?? (existing?.registration_doc_url ? "Document on file (replace)" : "Choose file")}
            </span>
            <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
          </label>
          {existing?.registration_doc_url && (
            <a href={existing.registration_doc_url} target="_blank" rel="noreferrer" className="text-xs text-sky flex items-center gap-1 mt-1">
              <FileText className="h-3 w-3" /> Current document
            </a>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
        </div>
        <div><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Pincode</Label><Input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        </div>
        <div><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
        <div><Label>About your work</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} /></div>

        {(orgType === "shelter" || orgType === "sanctuary" || orgType === "zoo") && (
          <>
            <div><Label>Donation UPI ID</Label><Input value={form.donation_upi} onChange={(e) => setForm({ ...form, donation_upi: e.target.value })} placeholder="name@bank" /></div>
            <div><Label>Donation page URL</Label><Input value={form.donation_url} onChange={(e) => setForm({ ...form, donation_url: e.target.value })} /></div>
          </>
        )}

        <div>
          <Label>Facility photos (optional)</Label>
          <input type="file" accept="image/*" multiple onChange={(e) => setPhotoFiles(Array.from(e.target.files ?? []))} className="text-sm" />
          {photoFiles.length > 0 && <div className="text-xs text-muted-foreground mt-1">{photoFiles.length} selected</div>}
        </div>

        <Button onClick={() => submit.mutate()} disabled={submit.isPending || !isOrg} className="w-full rounded-xl h-12 mt-2">
          {submit.isPending ? "Submitting…" : existing ? "Update & resubmit" : "Submit for review"}
        </Button>
      </div>
    </div>
  );
};

export default OrgOnboarding;