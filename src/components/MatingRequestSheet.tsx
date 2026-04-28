import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Heart, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const MatingRequestSheet = ({
  open,
  onOpenChange,
  toListing,
  myEligiblePets,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  toListing: { pet_id: string; owner_id: string; pets: { name: string } };
  myEligiblePets: { id: string; name: string }[];
}) => {
  const nav = useNavigate();
  const [fromPetId, setFromPetId] = useState(myEligiblePets[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!fromPetId) return toast.error("Pick one of your pets");
    setSending(true);
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("mating_requests").insert({
      from_pet_id: fromPetId,
      to_pet_id: toListing.pet_id,
      from_owner_id: u.user!.id,
      to_owner_id: toListing.owner_id,
      message: message.trim() || null,
    }).select("id").single();
    setSending(false);
    if (error) {
      if (error.message.includes("duplicate")) return toast.error("Already requested with this pet");
      return toast.error(error.message);
    }
    toast.success("Request sent");
    onOpenChange(false);
    nav("/mates/manage");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-hairline">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-primary-soft rounded-full p-2"><Heart className="h-5 w-5 text-primary" /></div>
            <SheetTitle className="font-display text-2xl">Send request to {toListing.pets?.name}</SheetTitle>
          </div>
          <p className="text-sm text-muted-foreground">A polite intro goes a long way.</p>
        </SheetHeader>
        <div className="space-y-4 mt-5 pb-6">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">From your pet</Label>
            <div className="flex gap-2 flex-wrap">
              {myEligiblePets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setFromPetId(p.id)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    fromPetId === p.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-hairline"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Message (optional)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hi! My Labrador is fully vaccinated and KCI registered…"
              rows={4}
              className="rounded-2xl border-hairline"
            />
          </div>
          <Button onClick={submit} disabled={sending || !fromPetId} size="lg" className="w-full rounded-2xl h-12 gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />} Send request
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
