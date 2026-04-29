import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft, BatteryFull, BatteryLow, MapPin, Plus, Radio, Shield, Loader2, Copy } from "lucide-react";
import { LeafletMap, type MapMarker } from "@/components/maps/LeafletMap";
import { toast } from "sonner";

export default function PetTracker() {
  const { petId } = useParams<{ petId: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [pairOpen, setPairOpen] = useState(false);
  const [fenceOpen, setFenceOpen] = useState(false);
  const [pinging, setPinging] = useState(false);

  const { data: pet } = useQuery({
    queryKey: ["pet", petId],
    enabled: !!petId,
    queryFn: async () => {
      const { data } = await supabase.from("pets").select("id,name,owner_id,avatar_url").eq("id", petId!).maybeSingle();
      return data;
    },
  });

  const isOwner = !!user && pet && user.id === pet.owner_id;

  const { data: device } = useQuery({
    queryKey: ["gps-device", petId],
    enabled: !!petId && !!isOwner,
    queryFn: async () => {
      const { data } = await supabase
        .from("gps_devices" as any)
        .select("*")
        .eq("pet_id", petId!)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: pings } = useQuery({
    queryKey: ["gps-pings", device?.id],
    enabled: !!device?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("gps_pings" as any)
        .select("id,lat,lng,recorded_at,outside_geofence,battery_pct")
        .eq("device_id", device.id)
        .order("recorded_at", { ascending: false })
        .limit(50);
      return (data ?? []) as any[];
    },
  });

  const { data: fences } = useQuery({
    queryKey: ["geofences", petId],
    enabled: !!petId && !!isOwner,
    queryFn: async () => {
      const { data } = await supabase
        .from("geofences" as any)
        .select("*")
        .eq("pet_id", petId!)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  // Realtime stream of new pings
  useEffect(() => {
    if (!device?.id) return;
    const ch = supabase
      .channel(`gps:${device.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "gps_pings", filter: `device_id=eq.${device.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["gps-pings", device.id] });
          qc.invalidateQueries({ queryKey: ["gps-device", petId] });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [device?.id, petId, qc]);

  const last = pings?.[0];
  const markers: MapMarker[] = useMemo(() => {
    const m: MapMarker[] = [];
    if (last) m.push({ id: "last", lat: Number(last.lat), lng: Number(last.lng), color: "primary", title: pet?.name ?? "Pet", description: "Last ping" });
    (fences ?? []).forEach((f) => m.push({
      id: `fence-${f.id}`, lat: Number(f.center_lat), lng: Number(f.center_lng),
      color: "success", title: f.name, description: `Safe zone · ${f.radius_m}m`,
    }));
    return m;
  }, [last, fences, pet?.name]);

  // Phone-as-tracker: send a single ping using current location
  const sendPhonePing = async () => {
    if (!device?.pairing_code) return;
    setPinging(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10_000 }));
      const { error } = await supabase.rpc("ingest_gps_ping" as any, {
        _pairing_code: device.pairing_code,
        _lat: pos.coords.latitude,
        _lng: pos.coords.longitude,
        _accuracy_m: pos.coords.accuracy ?? null,
        _battery_pct: null,
      });
      if (error) throw error;
      toast.success("Location pinged");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not get location");
    } finally {
      setPinging(false);
    }
  };

  if (!pet) return <div className="container-app py-10 text-sm text-muted-foreground">Loading…</div>;
  if (!isOwner) {
    return (
      <div className="container-app py-10 text-sm">
        <Button variant="ghost" size="sm" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <p className="mt-4">Live tracker is private to the pet's owner.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pad-bottom-safe">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline">
        <div className="container-app h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="font-display text-xl truncate flex-1">{pet.name} · Live tracker</h1>
        </div>
      </header>

      <main className="container-app py-5 space-y-4">
        {!device ? (
          <Card className="rounded-2xl border-hairline shadow-none p-6 text-center space-y-4">
            <Radio className="h-8 w-8 text-primary mx-auto" />
            <div>
              <h2 className="font-display text-xl">No tracker paired</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Pair a GPS collar, AirTag-style tag, or use your phone as a temporary tracker.
              </p>
            </div>
            <Button className="w-full h-11 rounded-xl" onClick={() => setPairOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Pair a tracker
            </Button>
          </Card>
        ) : (
          <>
            <Card className="rounded-2xl border-hairline shadow-none p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Radio className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{device.label} · {device.device_type}</div>
                <div className="text-xs text-muted-foreground">
                  {device.last_seen_at
                    ? `Last seen ${new Date(device.last_seen_at).toLocaleTimeString()}`
                    : "Awaiting first ping"}
                </div>
              </div>
              {typeof device.battery_pct === "number" && (
                <div className="flex items-center gap-1 text-xs">
                  {device.battery_pct < 20
                    ? <BatteryLow className="h-4 w-4 text-destructive" />
                    : <BatteryFull className="h-4 w-4 text-primary" />}
                  <span>{device.battery_pct}%</span>
                </div>
              )}
            </Card>

            {last ? (
              <Card className="rounded-2xl border-hairline shadow-none overflow-hidden">
                <LeafletMap
                  center={[Number(last.lat), Number(last.lng)]}
                  zoom={15}
                  height="280px"
                  markers={markers}
                />
                {last.outside_geofence && (
                  <div className="px-4 py-2 text-xs text-destructive border-t border-hairline">
                    ⚠ Last ping was outside a safe zone
                  </div>
                )}
              </Card>
            ) : (
              <Card className="rounded-2xl border-hairline shadow-none p-6 text-sm text-muted-foreground text-center">
                Awaiting first ping from the device.
              </Card>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={sendPhonePing} disabled={pinging}>
                {pinging ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <MapPin className="h-4 w-4 mr-1" />}
                Send phone ping
              </Button>
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setFenceOpen(true)}>
                <Shield className="h-4 w-4 mr-1" /> Add safe zone
              </Button>
            </div>

            {/* Pairing code visible to owner so they can flash a device */}
            <Card className="rounded-2xl border-hairline shadow-none p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Device pairing code</div>
              <div className="flex items-center gap-2">
                <code className="font-mono text-sm flex-1 truncate">{device.pairing_code}</code>
                <Button size="icon" variant="ghost" onClick={() => {
                  navigator.clipboard.writeText(device.pairing_code);
                  toast.success("Copied");
                }}><Copy className="h-4 w-4" /></Button>
              </div>
            </Card>

            {(fences?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Safe zones ({fences!.length})</div>
                {fences!.map((f) => (
                  <Card key={f.id} className="rounded-2xl border-hairline shadow-none p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{f.name}</div>
                      <div className="text-xs text-muted-foreground">{f.radius_m}m radius</div>
                    </div>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                      const { error } = await supabase.from("geofences" as any).delete().eq("id", f.id);
                      if (error) return toast.error(error.message);
                      qc.invalidateQueries({ queryKey: ["geofences", petId] });
                    }}>Remove</Button>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <PairSheet open={pairOpen} onOpenChange={setPairOpen} petId={petId!} ownerId={user!.id}
        onPaired={() => { qc.invalidateQueries({ queryKey: ["gps-device", petId] }); }} />
      <FenceSheet open={fenceOpen} onOpenChange={setFenceOpen} petId={petId!} ownerId={user!.id}
        defaultCenter={last ? [Number(last.lat), Number(last.lng)] : null}
        onCreated={() => { qc.invalidateQueries({ queryKey: ["geofences", petId] }); }} />
    </div>
  );
}

function PairSheet({ open, onOpenChange, petId, ownerId, onPaired }: {
  open: boolean; onOpenChange: (v: boolean) => void; petId: string; ownerId: string; onPaired: () => void;
}) {
  const [label, setLabel] = useState("Tracker");
  const [type, setType] = useState<"collar"|"airtag"|"phone"|"other">("phone");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("gps_devices" as any).insert({
      pet_id: petId, owner_id: ownerId, label: label.trim() || "Tracker", device_type: type,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Tracker paired");
    onPaired();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-hairline px-5 pb-8 pt-6">
        <SheetHeader className="text-left"><SheetTitle className="font-display text-2xl">Pair a tracker</SheetTitle></SheetHeader>
        <div className="mt-5 space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} className="rounded-xl border-hairline" maxLength={40} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Device type</Label>
            <div className="grid grid-cols-4 gap-2">
              {(["collar","airtag","phone","other"] as const).map((t) => (
                <Button key={t} type="button" variant={type === t ? "default" : "outline"}
                  className="rounded-xl capitalize" onClick={() => setType(t)}>{t}</Button>
              ))}
            </div>
          </div>
          <Button className="w-full h-11 rounded-xl" disabled={saving} onClick={save}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Generate pairing code
          </Button>
          <p className="text-xs text-muted-foreground">
            You'll get an 8-character pairing code to flash onto a hardware tracker, or use your phone to ping the location.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FenceSheet({ open, onOpenChange, petId, ownerId, defaultCenter, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; petId: string; ownerId: string;
  defaultCenter: [number, number] | null; onCreated: () => void;
}) {
  const [name, setName] = useState("Home");
  const [radius, setRadius] = useState("200");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    let lat = defaultCenter?.[0] ?? null;
    let lng = defaultCenter?.[1] ?? null;
    if (lat == null || lng == null) {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8_000 }));
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } catch {
        return toast.error("Need a location to centre the safe zone");
      }
    }
    setSaving(true);
    const { error } = await supabase.from("geofences" as any).insert({
      pet_id: petId, owner_id: ownerId, name: name.trim() || "Home",
      center_lat: lat, center_lng: lng, radius_m: Math.max(50, Math.min(5000, Number(radius) || 200)),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Safe zone added");
    onCreated();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-hairline px-5 pb-8 pt-6">
        <SheetHeader className="text-left"><SheetTitle className="font-display text-2xl">Add a safe zone</SheetTitle></SheetHeader>
        <div className="mt-5 space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl border-hairline" maxLength={40} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Radius (50–5000 m)</Label>
            <Input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} className="rounded-xl border-hairline" />
          </div>
          <Button className="w-full h-11 rounded-xl" disabled={saving} onClick={save}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Save safe zone
          </Button>
          <p className="text-xs text-muted-foreground">
            Centred on the last known location, or your current location if none.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}