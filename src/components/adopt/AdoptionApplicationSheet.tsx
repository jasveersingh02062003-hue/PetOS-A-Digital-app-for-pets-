import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shelterId: string;
  listingId?: string;
  isVolunteer?: boolean;
};

export const AdoptionApplicationSheet = ({ open, onOpenChange, shelterId, listingId, isVolunteer = false }: Props) => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    home_description: "",
    prior_experience: "",
    family_size: "",
    has_yard: false,
    other_pets: "",
    phone: "",
    city: "",
  });

  const submit = async () => {
    if (!user) {
      nav("/auth");
      return;
    }
    if (!isVolunteer && !form.home_description.trim()) {
      toast.error("Please describe your home");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("adoption_applications").insert({
      applicant_id: user.id,
      shelter_id: shelterId,
      listing_id: listingId ?? null,
      is_volunteer_interest: isVolunteer,
      home_description: form.home_description.trim() || null,
      prior_experience: form.prior_experience.trim() || null,
      family_size: form.family_size ? parseInt(form.family_size, 10) : null,
      has_yard: form.has_yard,
      other_pets: form.other_pets.trim() || null,
      phone: form.phone.trim() || null,
      city: form.city.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(isVolunteer ? "Thanks! The shelter will reach out." : "Application submitted");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[92vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>{isVolunteer ? "Volunteer with this shelter" : "Adoption application"}</SheetTitle>
          <SheetDescription>
            {isVolunteer
              ? "Tell them how you'd like to help — fostering, transport, weekend visits, donations."
              : "Shelters review every application. A short, honest answer goes a long way."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 mt-4">
          <div>
            <Label className="text-xs">{isVolunteer ? "How would you like to help?" : "Tell us about your home"}</Label>
            <Textarea
              rows={3}
              value={form.home_description}
              onChange={(e) => setForm({ ...form, home_description: e.target.value })}
              placeholder={isVolunteer ? "Foster, transport, dog-walking…" : "Apartment / house, who lives with you, daily routine…"}
            />
          </div>

          {!isVolunteer && (
            <>
              <div>
                <Label className="text-xs">Prior pet experience</Label>
                <Textarea
                  rows={2}
                  value={form.prior_experience}
                  onChange={(e) => setForm({ ...form, prior_experience: e.target.value })}
                  placeholder="Pets you've raised, training experience…"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Family size</Label>
                  <Input
                    type="number"
                    value={form.family_size}
                    onChange={(e) => setForm({ ...form, family_size: e.target.value })}
                  />
                </div>
                <div className="flex items-end justify-between rounded-md border border-input px-3 h-10">
                  <Label className="text-xs">Has yard</Label>
                  <Switch checked={form.has_yard} onCheckedChange={(v) => setForm({ ...form, has_yard: v })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Other pets at home</Label>
                <Input
                  value={form.other_pets}
                  onChange={(e) => setForm({ ...form, other_pets: e.target.value })}
                  placeholder="e.g. 1 dog, 2 cats"
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">City</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
          </div>

          <Button onClick={submit} disabled={submitting} className="w-full rounded-xl h-12 mt-2">
            {submitting ? "Submitting…" : isVolunteer ? "Send interest" : "Submit application"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};