import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/ImageUpload";
import { Loader2, MapPin, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type Pet = { id: string; name: string; avatar_url: string | null; city: string | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pet: Pet;
};

export const MissingCreateSheet = ({ open, onOpenChange, pet }: Props) => {
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();

  const [photoUrl, setPhotoUrl] = useState<string | null>(pet.avatar_url);
  const [city, setCity] = useState<string>(pet.city ?? profile?.city ?? "");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [reward, setReward] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported on this device");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocating(false);
        toast.success("Location captured");
      },
      () => {
        setLocating(false);
        toast.error("Couldn't get your location. You can still add a city.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const submit = async () => {
    if (!user) return;
    if (!city.trim() && !lat) return toast.error("Add a city or share your location");
    setSubmitting(true);
    const { data, error } = await supabase
      .from("missing_pets")
      .insert({
        pet_id: pet.id,
        owner_id: user.id,
        photo_url: photoUrl,
        last_seen_lat: lat,
        last_seen_lng: lng,
        last_seen_city: city.trim() || null,
        reward_inr: reward ? parseInt(reward, 10) : 0,
        note: note.trim() || null,
        status: "active",
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (error) {
      if (error.message.includes("Free plan is limited")) {
        toast.error("You already have an active missing-pet listing. Upgrade to Plus for unlimited.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    qc.invalidateQueries({ queryKey: ["missing-pets"] });
    onOpenChange(false);
    toast.success("Alert sent to your neighborhood 🐾");
    nav(`/missing/${data.id}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-hairline px-5 pb-8 pt-6 max-h-[92vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
            <AlertTriangle className="h-5 w-5 text-destructive" strokeWidth={1.8} />
          </div>
          <SheetTitle className="font-display text-2xl">Report {pet.name} missing</SheetTitle>
          <SheetDescription className="text-sm">
            We'll alert pet parents in your city right away. You can mark {pet.name} found anytime.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Recent photo</Label>
            <ImageUpload value={photoUrl} onChange={setPhotoUrl} bucket="missing-pets" aspect="square" label="Add a clear photo" />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Last-seen city</Label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Bengaluru"
              className="rounded-xl border-hairline h-11"
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Pin a location (optional)</Label>
            <Button
              type="button"
              variant="outline"
              onClick={useMyLocation}
              disabled={locating}
              className="w-full h-11 rounded-xl border-hairline justify-start gap-2"
            >
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              {lat ? `Pinned · ${lat.toFixed(4)}, ${lng?.toFixed(4)}` : "Use my current location"}
            </Button>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Reward (optional, in ₹)</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={reward}
              onChange={(e) => setReward(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 1000"
              className="rounded-xl border-hairline h-11"
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Note for finders (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Scared of fireworks. Please don't chase — call instead."
              className="rounded-xl border-hairline min-h-[80px]"
              maxLength={300}
            />
          </div>

          <Button
            className="w-full h-12 rounded-2xl bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            disabled={submitting}
            onClick={submit}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Send alert
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            Free for early users · Your phone number stays private
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};
