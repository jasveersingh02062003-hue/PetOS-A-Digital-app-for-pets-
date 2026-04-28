import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  providerId: string;
  providerName: string;
};

export const BookingSheet = ({ open, onOpenChange, providerId, providerName }: Props) => {
  const { user } = useAuth();
  const [petId, setPetId] = useState<string>("");
  const [when, setWhen] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const { data: pets } = useQuery({
    queryKey: ["my-pets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("id, name")
        .eq("owner_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user && open,
  });

  const submit = async () => {
    if (!user) {
      toast.error("Please sign in first");
      return;
    }
    if (!when) {
      toast.error("Pick a date & time");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("service_bookings").insert({
      provider_id: providerId,
      customer_id: user.id,
      pet_id: petId || null,
      scheduled_at: new Date(when).toISOString(),
      notes: notes || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Booking requested");
    onOpenChange(false);
    setNotes("");
    setWhen("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-display">Book {providerName}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label>Pet (optional)</Label>
            <Select value={petId} onValueChange={setPetId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a pet" />
              </SelectTrigger>
              <SelectContent>
                {pets?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>When</Label>
            <Input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              placeholder="Any special instructions"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button onClick={submit} disabled={saving} className="w-full rounded-full h-12">
            {saving ? "Sending…" : "Request booking"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
