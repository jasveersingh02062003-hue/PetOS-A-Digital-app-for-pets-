import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Search, MessageSquare, Video, MapPin, Star } from "lucide-react";
import { toast } from "sonner";

type Mode = "chat" | "video" | "in_clinic";

const BookAppointment = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();

  const [city, setCity] = useState("");
  const [spec, setSpec] = useState("");
  const [mode, setMode] = useState<Mode>("chat");
  const [picked, setPicked] = useState<any>(null);
  const [petId, setPetId] = useState<string>(params.get("pet") || "");
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");
  const triageSessionId = params.get("triage") || undefined;

  const { data: pets } = useQuery({
    queryKey: ["my-pets-book", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pets")
        .select("id, name, species, avatar_url")
        .eq("owner_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: vets, isLoading } = useQuery({
    queryKey: ["vets-search", city, spec, mode],
    queryFn: async () => {
      let q = supabase
        .from("vet_profiles" as any)
        .select("user_id, display_name, clinic_name, city, specialisations, price_chat_inr, price_video_inr, price_clinic_inr, rating_avg, rating_count, photo_url, consult_modes")
        .eq("active", true)
        .eq("onboarded", true)
        .contains("consult_modes", [mode])
        .limit(50);
      if (city) q = q.ilike("city", `%${city}%`);
      if (spec) q = q.contains("specialisations", [spec]);
      const { data } = await q;
      return (data ?? []) as any[];
    },
  });

  const fee = useMemo(() => {
    if (!picked) return 0;
    return mode === "chat" ? picked.price_chat_inr : mode === "video" ? picked.price_video_inr : picked.price_clinic_inr;
  }, [picked, mode]);

  const book = async () => {
    if (!user || !picked || !petId || !when) {
      return toast.error("Choose a vet, pet and time");
    }
    const { data, error } = await supabase
      .from("appointments" as any)
      .insert({
        owner_id: user.id,
        vet_id: picked.user_id,
        pet_id: petId,
        mode,
        scheduled_at: new Date(when).toISOString(),
        notes: notes || null,
        triage_session_id: triageSessionId ?? null,
      })
      .select("id")
      .single() as { data: { id: string } | null; error: any };
    if (error) return toast.error(error.message);
    if (triageSessionId) {
      await supabase
        .from("vet_triage_sessions" as any)
        .update({ escalated_to_appointment_id: data.id, closed_at: new Date().toISOString() })
        .eq("id", triageSessionId);
    }
    toast.success("Appointment requested");
    nav("/profile");
  };

  return (
    <div className="container-app pad-top-safe pb-24">
      <header className="pt-4 pb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-xl">Book a vet</h1>
      </header>

      {!picked && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {(["chat", "video", "in_clinic"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-2xl border p-3 flex flex-col items-center gap-1 text-xs ${
                  mode === m ? "border-primary bg-primary-soft" : "border-hairline"
                }`}
              >
                {m === "chat" && <MessageSquare className="h-4 w-4" />}
                {m === "video" && <Video className="h-4 w-4" />}
                {m === "in_clinic" && <MapPin className="h-4 w-4" />}
                <span className="capitalize">{m.replace("_", " ")}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <Input placeholder="Specialisation" value={spec} onChange={(e) => setSpec(e.target.value)} className="flex-1" />
          </div>

          {isLoading && <div className="text-sm text-muted-foreground text-center py-6">Searching…</div>}
          {!isLoading && (vets?.length ?? 0) === 0 && (
            <Card className="rounded-2xl border-hairline p-6 text-center text-sm text-muted-foreground">
              No vets match — try widening filters.
            </Card>
          )}
          <div className="space-y-3">
            {vets?.map((v) => (
              <Card key={v.user_id} className="rounded-2xl border-hairline p-4 flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-primary-soft overflow-hidden flex items-center justify-center">
                  {v.photo_url ? <img src={v.photo_url} alt={v.display_name} className="h-full w-full object-cover" /> : <span className="text-sm font-display">{v.display_name?.[0]}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-base truncate">{v.display_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{v.clinic_name} · {v.city || "—"}</div>
                  <div className="text-xs flex items-center gap-2 mt-0.5">
                    {v.rating_count > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {v.rating_avg?.toFixed(1)}
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      ₹{mode === "chat" ? v.price_chat_inr : mode === "video" ? v.price_video_inr : v.price_clinic_inr}
                    </span>
                  </div>
                </div>
                <Button size="sm" className="rounded-full" onClick={() => setPicked(v)}>Select</Button>
              </Card>
            ))}
          </div>
        </>
      )}

      {picked && (
        <Card className="rounded-2xl border-hairline p-5 space-y-4">
          <div>
            <div className="font-display text-lg">{picked.display_name}</div>
            <div className="text-xs text-muted-foreground">{picked.clinic_name}</div>
          </div>

          <div className="space-y-1.5">
            <Label>Pet</Label>
            <select
              className="w-full h-11 rounded-xl border border-hairline bg-background px-3 text-sm"
              value={petId}
              onChange={(e) => setPetId(e.target.value)}
            >
              <option value="">Choose pet…</option>
              {pets?.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.species}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>When</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Reason for visit</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Symptoms, concerns, recent changes…" />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-hairline">
            <span className="text-sm text-muted-foreground">Fee (free during beta)</span>
            <span className="font-display">₹{fee}</span>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-full h-12" onClick={() => setPicked(null)}>Back</Button>
            <Button className="flex-1 rounded-full h-12" onClick={book}>Request</Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default BookAppointment;
