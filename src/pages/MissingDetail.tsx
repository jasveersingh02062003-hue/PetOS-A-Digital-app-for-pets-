import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/ImageUpload";
import { ArrowLeft, MapPin, Clock, Eye, CheckCircle2, Loader2, Share2, Printer, Sparkles, Gift } from "lucide-react";
import { toast } from "sonner";
import { LeafletMap, type MapMarker } from "@/components/maps/LeafletMap";
import { MissingPoster } from "@/components/missing/MissingPoster";
import { PayButton } from "@/components/payments/PayButton";

const timeAgo = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff} min ago`;
  if (diff < 60 * 24) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / (60 * 24))}d ago`;
};

const MissingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: missing, isLoading } = useQuery({
    queryKey: ["missing", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missing_pets")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: pets } = await supabase.rpc("get_pets_public");
      const pet = (pets ?? []).find((p: any) => p.id === data.pet_id);
      const { data: profiles } = await supabase.rpc("get_profiles_public");
      const owner = (profiles ?? []).find((p: any) => p.id === data.owner_id);
      return { ...data, pet, owner };
    },
  });

  const { data: sightings } = useQuery({
    queryKey: ["sightings", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missing_pet_sightings")
        .select("*")
        .eq("missing_pet_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Realtime sighting updates
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`sightings-${id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "missing_pet_sightings", filter: `missing_pet_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["sightings", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  const [sightingOpen, setSightingOpen] = useState(false);
  const [posterOpen, setPosterOpen] = useState(false);
  const [sightingPhoto, setSightingPhoto] = useState<string | null>(null);
  const [sightingNote, setSightingNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const [releasingFinderId, setReleasingFinderId] = useState<string | null>(null);

  if (isLoading) return <div className="container-app pt-12 text-sm text-muted-foreground">Loading…</div>;
  if (!missing) return <div className="container-app pt-12 text-sm">Not found.</div>;

  const isOwner = user?.id === missing.owner_id;
  const isResolved = missing.status === "resolved";
  const rewardStatus = (missing as any).reward_status as string | undefined;
  const rewardEscrowed = rewardStatus === "escrowed";
  const rewardReleased = rewardStatus === "released";
  const canFundEscrow =
    isOwner && !isResolved && !!missing.reward_inr && (!rewardStatus || rewardStatus === "none");

  const releaseRewardTo = async (finderId: string) => {
    if (!confirm(`Release ₹${missing.reward_inr} reward to this finder? This cannot be undone.`)) return;
    setReleasingFinderId(finderId);
    const { error } = await supabase.rpc("release_reward" as any, {
      _missing_pet_id: missing.id,
      _finder_id: finderId,
    });
    setReleasingFinderId(null);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["missing", id] });
    toast.success("Reward released — finder notified 🎉");
  };

  const submitSighting = async () => {
    if (!user || !id) return;
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8_000 }));
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      // optional — owner still gets the note
    }
    setSubmitting(true);
    const { error } = await supabase.from("missing_pet_sightings").insert({
      missing_pet_id: id,
      reporter_id: user.id,
      photo_url: sightingPhoto,
      lat, lng,
      note: sightingNote.trim() || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setSightingOpen(false);
    setSightingPhoto(null);
    setSightingNote("");
    toast.success("Thank you — the owner has been notified.");
  };

  const markFound = async () => {
    if (!confirm(`Mark ${missing.pet?.name ?? "your pet"} as found?`)) return;
    setResolving(true);
    const { error } = await supabase
      .from("missing_pets")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", missing.id);
    setResolving(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["missing", id] });
    qc.invalidateQueries({ queryKey: ["missing-pets"] });
    toast.success("So glad they're home 🐾");
  };

  const boostReach = async () => {
    if (!user || !missing) return;
    setBoosting(true);
    const { data, error } = await supabase.functions.invoke("create-one-time-checkout", {
      body: { kind: "missing_listing", ref_id: missing.id },
    });
    setBoosting(false);
    if (error) return toast.error(error.message);
    if (data?.status === "checkout" && data?.url) {
      window.location.href = data.url;
      return;
    }
    if (data?.status === "free_for_plus" || data?.status === "beta_free") {
      // Free path → set boost directly (webhook only fires on paid Stripe)
      const until = new Date();
      until.setDate(until.getDate() + 7);
      const { error: upErr } = await supabase
        .from("missing_pets")
        .update({ boosted_until: until.toISOString() } as any)
        .eq("id", missing.id);
      if (upErr) return toast.error(upErr.message);
      qc.invalidateQueries({ queryKey: ["missing", id] });
      toast.success(
        data.status === "free_for_plus"
          ? "Boost activated — Plus perk 🌟"
          : "Boost activated for 7 days",
      );
    }
  };

  return (
    <div className="min-h-screen bg-background pad-bottom-safe">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline">
        <div className="container-app h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="font-display text-xl truncate">{isResolved ? "Found" : "Missing"}</h1>
        </div>
      </header>

      <main className="container-app py-6 space-y-5">
        {missing.photo_url && (
          <div className="aspect-square rounded-3xl overflow-hidden border border-hairline">
            <img src={missing.photo_url} alt={missing.pet?.name} className="w-full h-full object-cover" />
          </div>
        )}

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-3xl">{missing.pet?.name ?? "Pet"}</h2>
            {missing.reward_inr ? (
              <span className="text-sm font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
                ₹{missing.reward_inr} reward
              </span>
            ) : null}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {missing.pet?.species}{missing.pet?.breed ? ` · ${missing.pet.breed}` : ""}
          </div>
        </div>

        {isResolved && (
          <Card className="rounded-2xl border-hairline shadow-none p-4 bg-primary/5 text-sm">
            <div className="flex items-center gap-2 font-medium text-primary">
              <CheckCircle2 className="h-4 w-4" /> {missing.pet?.name ?? "This pet"} has been found.
            </div>
            <p className="text-muted-foreground text-xs mt-1">Thank you to everyone who helped.</p>
          </Card>
        )}

        <Card className="rounded-2xl border-hairline shadow-none p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-primary" />
            <span>Last seen in <strong>{missing.last_seen_city ?? "—"}</strong></span>
          </div>
          {(missing.last_seen_lat && missing.last_seen_lng) && (
            <div className="text-xs text-muted-foreground pl-6">
              Pin: {Number(missing.last_seen_lat).toFixed(4)}, {Number(missing.last_seen_lng).toFixed(4)}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-primary" />
            <span>Reported {timeAgo(missing.created_at)}</span>
          </div>
          {missing.note && (
            <p className="text-sm border-t border-hairline pt-3 leading-relaxed">{missing.note}</p>
          )}
        </Card>

        {(missing.last_seen_lat && missing.last_seen_lng) && (() => {
          const seenMarkers: MapMarker[] = [
            { id: "last", lat: Number(missing.last_seen_lat), lng: Number(missing.last_seen_lng), color: "danger", title: "Last seen here" },
            ...(sightings ?? []).filter((s: any) => s.lat && s.lng).map((s: any) => ({
              id: s.id, lat: Number(s.lat), lng: Number(s.lng), color: "success" as const,
              title: "Sighting", description: s.note ?? new Date(s.created_at).toLocaleString(),
            })),
          ];
          return (
            <LeafletMap
              center={[Number(missing.last_seen_lat), Number(missing.last_seen_lng)]}
              zoom={14}
              height="280px"
              markers={seenMarkers}
            />
          );
        })()}

        {!isResolved && (
          <div className="space-y-2">

            {!isOwner && (
              <Button className="w-full h-12 rounded-2xl" onClick={() => setSightingOpen(true)}>
                <Eye className="h-4 w-4 mr-2" /> I've seen this pet
              </Button>
            )}
            {isOwner && (
              <Button
                variant="outline"
                className="w-full h-12 rounded-2xl border-hairline"
                disabled={resolving}
                onClick={markFound}
              >
                {resolving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Mark as found
              </Button>
            )}

            {canFundEscrow && (
              <PayButton
                kind="reward_escrow"
                refId={missing.id}
                productName={`Reward escrow · ${missing.pet?.name ?? "missing pet"}`}
                amountInr={missing.reward_inr}
                next={`/missing/${missing.id}`}
                label={`Fund ₹${missing.reward_inr} reward (escrow)`}
                className="w-full h-12 rounded-2xl"
              />
            )}
            {isOwner && rewardEscrowed && (
              <div className="rounded-2xl border-hairline border bg-primary/5 px-4 py-3 text-sm flex items-center gap-2">
                <Gift className="h-4 w-4 text-primary" />
                <span>₹{missing.reward_inr} held in escrow — release from a sighting card below.</span>
              </div>
            )}
            {isOwner && rewardReleased && (
              <div className="rounded-2xl border-hairline border bg-primary/5 px-4 py-3 text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Reward released to finder.</span>
              </div>
            )}

            {isOwner && (() => {
              const boostedUntil = (missing as any).boosted_until
                ? new Date((missing as any).boosted_until)
                : null;
              const isBoosted = !!boostedUntil && boostedUntil > new Date();
              if (isBoosted) {
                const daysLeft = Math.max(
                  1,
                  Math.ceil((boostedUntil.getTime() - Date.now()) / 86_400_000),
                );
                return (
                  <div className="rounded-2xl border-hairline border bg-amber-500/10 px-4 py-3 text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    <span>
                      Boost active — extra reach for {daysLeft} more {daysLeft === 1 ? "day" : "days"}.
                    </span>
                  </div>
                );
              }
              return (
                <Button
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-amber-500 to-coral text-white border-0"
                  disabled={boosting}
                  onClick={boostReach}
                >
                  {boosting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Boost reach (₹499 · 7 days)
                </Button>
              );
            })()}
            <Button
              variant="outline"
              className="w-full h-12 rounded-2xl border-hairline"
              onClick={async () => {
                const name = missing.pet?.name ?? "our pet";
                const where = missing.last_seen_city ? ` near ${missing.last_seen_city}` : "";
                const url = `${window.location.origin}/missing/${missing.id}`;
                const text = `Help us find ${name} 🐾\nLast seen${where}.${missing.note ? `\n\n${missing.note}` : ""}\n\nDetails & sightings: ${url}`;
                try {
                  if (navigator.share) {
                    await navigator.share({ title: `Missing: ${name}`, text, url });
                  } else {
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                  }
                } catch {
                  // user cancelled — silent
                }
              }}
            >
              <Share2 className="h-4 w-4 mr-2" /> Share link
            </Button>
            <Button
              variant="outline"
              className="w-full h-12 rounded-2xl border-hairline"
              onClick={() => setPosterOpen(true)}
            >
              <Printer className="h-4 w-4 mr-2" /> Download / print poster
            </Button>
          </div>
        )}

        <div>
          <h3 className="font-display text-lg mb-3">Sightings ({sightings?.length ?? 0})</h3>
          {!sightings?.length ? (
            <Card className="rounded-2xl border-hairline shadow-none p-6 text-center text-sm text-muted-foreground">
              No sightings yet. {isOwner ? "We'll notify you the moment one comes in." : ""}
            </Card>
          ) : (
            <div className="space-y-3">
              {sightings.map((s: any) => (
                <Card key={s.id} className="rounded-2xl border-hairline shadow-none p-3">
                  <div className="flex gap-3">
                    {s.photo_url ? (
                      <div className="h-16 w-16 rounded-xl bg-muted overflow-hidden shrink-0">
                        <img src={s.photo_url} alt="sighting" className="w-full h-full object-cover" />
                      </div>
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground">{timeAgo(s.created_at)}</div>
                      {s.note && <p className="text-sm mt-1">{s.note}</p>}
                      {s.lat && s.lng && (
                        <div className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{Number(s.lat).toFixed(4)}, {Number(s.lng).toFixed(4)}
                        </div>
                      )}
                      {isOwner && rewardEscrowed && s.reporter_id && (
                        <Button
                          size="sm"
                          className="mt-2 h-8 rounded-lg"
                          disabled={releasingFinderId === s.reporter_id}
                          onClick={() => releaseRewardTo(s.reporter_id)}
                        >
                          {releasingFinderId === s.reporter_id
                            ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            : <Gift className="h-3 w-3 mr-1" />}
                          Release ₹{missing.reward_inr} reward
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Sheet open={sightingOpen} onOpenChange={setSightingOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-hairline px-5 pb-8 pt-6 max-h-[88vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-2xl">Report a sighting</SheetTitle>
            <p className="text-sm text-muted-foreground">
              The owner gets notified instantly. Your location is only shared if you choose.
            </p>
          </SheetHeader>
          <div className="mt-5 space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Photo (optional)</Label>
              <ImageUpload value={sightingPhoto} onChange={setSightingPhoto} bucket="missing-pets" aspect="square" label="Add photo" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Note</Label>
              <Textarea
                value={sightingNote}
                onChange={(e) => setSightingNote(e.target.value)}
                placeholder="e.g. Walking near the cricket ground, looked healthy."
                className="rounded-xl border-hairline min-h-[80px]"
                maxLength={300}
              />
            </div>
            <Button className="w-full h-12 rounded-2xl" disabled={submitting} onClick={submitSighting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Send to owner
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <MissingPoster
        open={posterOpen}
        onOpenChange={setPosterOpen}
        petName={missing.pet?.name ?? "Pet"}
        species={missing.pet?.species}
        breed={missing.pet?.breed}
        city={missing.last_seen_city}
        reward={missing.reward_inr}
        note={missing.note}
        photoUrl={missing.photo_url}
        shareUrl={`${window.location.origin}/missing/${missing.id}`}
        contactPhone={(missing as any).contact_phone || (missing.owner as any)?.phone || null}
      />
    </div>
  );
};

export default MissingDetail;
