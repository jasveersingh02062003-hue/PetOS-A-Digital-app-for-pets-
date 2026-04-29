import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePets } from "@/hooks/useProfile";
import { ArrowLeft, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const TaxiNew = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: pets } = usePets();

  const { data: drivers } = useQuery({
    queryKey: ["taxi-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_providers")
        .select("id, name, city, hourly_rate_inr, trust_status")
        .eq("category", "pet_taxi")
        .eq("active", true)
        .order("trust_status", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const [providerId, setProviderId] = useState<string>("auto");
  const [petId, setPetId] = useState<string>("none");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [scheduled, setScheduled] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) { toast.error("Sign in first"); return; }
    if (!pickup.trim() || !dropoff.trim()) { toast.error("Pickup and drop-off required"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("transport_bookings")
        .insert({
          customer_id: user.id,
          provider_id: providerId === "auto" ? null : providerId,
          pet_id: petId === "none" ? null : petId,
          pickup_address: pickup.trim(),
          dropoff_address: dropoff.trim(),
          scheduled_at: new Date(scheduled).toISOString(),
          notes: notes.trim() || null,
          status: "requested",
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Pet taxi requested");
      nav(`/taxi/${data.id}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline">
        <div className="container-app h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="font-display text-xl">Book a pet taxi</h1>
        </div>
      </header>

      <main className="container-app py-6 space-y-4">
        <Card className="rounded-2xl border-hairline p-4 space-y-4">
          <div>
            <Label>Pickup address</Label>
            <Textarea rows={2} value={pickup} onChange={(e) => setPickup(e.target.value)} className="mt-1 rounded-xl" placeholder="e.g. 12 Main St, Bandra West" />
          </div>
          <div>
            <Label>Drop-off address</Label>
            <Textarea rows={2} value={dropoff} onChange={(e) => setDropoff(e.target.value)} className="mt-1 rounded-xl" placeholder="Vet clinic, groomer, boarding…" />
          </div>
          <div>
            <Label>When</Label>
            <Input type="datetime-local" value={scheduled} onChange={(e) => setScheduled(e.target.value)} className="mt-1 rounded-xl" />
          </div>

          {pets && pets.length > 0 && (
            <div>
              <Label>Pet</Label>
              <select value={petId} onChange={(e) => setPetId(e.target.value)} className="mt-1 w-full rounded-xl border border-hairline bg-background px-3 py-2 text-sm">
                <option value="none">— not specified —</option>
                {pets.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <Label>Driver</Label>
            <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className="mt-1 w-full rounded-xl border border-hairline bg-background px-3 py-2 text-sm">
              <option value="auto">Auto-assign nearest verified driver</option>
              {drivers?.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.city ? ` · ${d.city}` : ""}{d.hourly_rate_inr ? ` · ₹${d.hourly_rate_inr}/hr` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 rounded-xl" placeholder="Carrier provided · special handling…" />
          </div>

          <Button onClick={submit} disabled={saving} className="w-full rounded-xl h-11">
            <Car className="h-4 w-4 mr-1" /> {saving ? "Requesting…" : "Request taxi"}
          </Button>
        </Card>
      </main>
    </div>
  );
};

export default TaxiNew;
