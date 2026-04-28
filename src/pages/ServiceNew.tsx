import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";
import type { Database } from "@/integrations/supabase/types";

type ServiceCategory = Database["public"]["Enums"]["service_category"];

const ServiceNew = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ServiceCategory>("grooming");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [rate, setRate] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) return toast.error("Sign in first");
    if (!name) return toast.error("Name required");
    setSaving(true);
    const { error } = await supabase.from("service_providers").insert({
      owner_id: user.id,
      name,
      category,
      city: city || null,
      bio: bio || null,
      hourly_rate_inr: rate ? parseInt(rate) : null,
      contact_phone: phone || null,
      cover_url: coverUrl,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Listing created");
    nav("/services/manage");
  };

  return (
    <div className="container-app pad-top-safe pb-24">
      <header className="pt-4 pb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-xl">List a service</h1>
      </header>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Cover image</Label>
          <ImageUpload value={coverUrl} onChange={setCoverUrl} aspect="video" label="Add cover photo" />
        </div>
        <div className="space-y-1.5">
          <Label>Business name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as ServiceCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="grooming">Grooming</SelectItem>
              <SelectItem value="training">Training</SelectItem>
              <SelectItem value="walking">Walking</SelectItem>
              <SelectItem value="sitting">Sitting</SelectItem>
              <SelectItem value="boarding">Boarding</SelectItem>
              <SelectItem value="vet_clinic">Vet Clinic</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>City</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Hourly rate (₹)</Label>
          <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Phone (placeholder)</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Will be used for SMS later" />
        </div>
        <div className="space-y-1.5">
          <Label>About</Label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} />
        </div>
        <Button onClick={submit} disabled={saving} className="w-full rounded-full h-12">
          {saving ? "Saving…" : "Publish listing"}
        </Button>
      </div>
    </div>
  );
};

export default ServiceNew;
