import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePets } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldCheck, MapPin, Heart, Loader2, Stethoscope } from "lucide-react";
import { MatingRequestSheet } from "@/components/MatingRequestSheet";
import { useSeo } from "@/hooks/useSeo";
import { jsonLd } from "@/lib/seo";
import { ContactSellerSheet } from "@/components/ContactSellerSheet";
import { TrustSignals } from "@/components/trust/TrustSignals";
import { AnonReportButton } from "@/components/AnonReportButton";

const MateListing = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: pets } = usePets();
  const [reqOpen, setReqOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mating_listings")
        .select("*, pets:pet_id(*), profiles:owner_id(full_name, city, avatar_url)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const pet = (listing as any)?.pets;
  const profile = (listing as any)?.profiles;
  useSeo({
    title: listing ? `${pet?.name ?? "Pet"} for mating${pet?.breed ? ` — ${pet.breed}` : ""}` : "Mating listing",
    description:
      listing?.description?.slice(0, 150) ??
      `${pet?.breed ?? pet?.species ?? "Pet"} available for mating${listing?.city ? ` in ${listing.city}` : ""} on Petos.`,
    image: pet?.avatar_url ?? undefined,
    type: "article",
    jsonLd: listing
      ? jsonLd.pet({
          name: `${pet?.name ?? "Pet"} — mating`,
          species: pet?.species ?? undefined,
          breed: pet?.breed ?? undefined,
          image: pet?.avatar_url ?? undefined,
          description: listing.description ?? undefined,
          url: typeof window !== "undefined" ? window.location.href : "",
          priceInr: listing.fee_inr ?? 0,
          city: listing.city ?? undefined,
          sellerName: profile?.full_name ?? undefined,
        })
      : undefined,
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!listing) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="font-display text-xl">Listing not found</div>
      <Button variant="outline" onClick={() => nav("/discover")}>Back to discover</Button>
    </div>
  );

  const isOwn = listing.owner_id === user?.id;
  const myEligiblePets = pets?.filter((p) => p.vaccination_verified && p.discoverable_for_mating) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="container-app pad-top-safe pt-4 pb-3 flex items-center gap-3 border-b border-hairline">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="font-display text-lg leading-tight">Listing</div>
      </header>

      <div className="aspect-square bg-muted relative">
        {pet?.avatar_url ? (
          <img src={pet.avatar_url} alt={pet.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="w-full h-full grid place-items-center font-display text-6xl text-primary">{pet?.name?.[0]}</div>
        )}
      </div>

      <div className="container-app py-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl">{pet?.name}</h1>
              {pet?.vaccination_verified && (
                <Badge className="bg-primary-soft text-primary border-0 gap-1">
                  <ShieldCheck className="h-3 w-3" /> Verified
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">{[pet?.breed, pet?.species, pet?.gender].filter(Boolean).join(" · ")}</div>
          </div>
          <Badge variant="outline" className="capitalize border-hairline">{listing.intent}</Badge>
        </div>

        <Card className="rounded-2xl border-hairline bg-card shadow-none p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Fee" value={listing.fee_inr ? `₹${listing.fee_inr.toLocaleString("en-IN")}` : "Free"} />
            <Stat label="City" value={listing.city ?? "—"} />
            <Stat label="Travel" value={listing.travel_km ? `${listing.travel_km} km` : "Local"} />
          </div>
        </Card>

        {listing.description && (
          <Card className="rounded-2xl border-hairline bg-card shadow-none p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">About</div>
            <p className="text-sm leading-relaxed">{listing.description}</p>
          </Card>
        )}
        {listing.requirements && (
          <Card className="rounded-2xl border-hairline bg-card shadow-none p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Requirements</div>
            <p className="text-sm leading-relaxed">{listing.requirements}</p>
          </Card>
        )}

        <Card className="rounded-2xl border-hairline bg-card shadow-none p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary-soft text-primary grid place-items-center font-display">
            {profile?.full_name?.[0] ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{profile?.full_name ?? "Pet parent"}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              {profile?.city && <><MapPin className="h-3 w-3" />{profile.city}</>}
            </div>
            <div className="mt-1.5">
              <TrustSignals userId={listing.owner_id} compact />
            </div>
          </div>
        </Card>

        {!user ? (
          <Button onClick={() => setContactOpen(true)} size="lg" className="w-full rounded-2xl h-14 gap-2">
            <Heart className="h-5 w-5" /> Contact owner
          </Button>
        ) : !isOwn ? (
          <Button onClick={() => setReqOpen(true)} size="lg" className="w-full rounded-2xl h-14 gap-2" disabled={!myEligiblePets.length}>
            <Heart className="h-5 w-5" /> {myEligiblePets.length ? "Send mating request" : "List a verified pet to request"}
          </Button>
        ) : (
          <Button onClick={() => nav("/mates/manage")} variant="outline" size="lg" className="w-full rounded-2xl h-12 border-hairline">
            Manage your listings
          </Button>
        )}
        {user && !myEligiblePets.length && !isOwn && (
          <Button variant="link" onClick={() => nav("/mates/new")} className="w-full">
            <Stethoscope className="h-4 w-4 mr-1" /> List your pet first
          </Button>
        )}

        {!isOwn && (
          <div className="flex justify-end pt-1">
            <AnonReportButton subjectType="mate_listing" subjectId={listing.id} />
          </div>
        )}
      </div>

      <MatingRequestSheet
        open={reqOpen}
        onOpenChange={setReqOpen}
        toListing={listing as any}
        myEligiblePets={myEligiblePets}
      />

      <ContactSellerSheet
        open={contactOpen}
        onOpenChange={setContactOpen}
        intent={{
          kind: "contact_seller",
          listingId: listing.id,
          listingType: "mate",
          ownerId: listing.owner_id,
          redirect: `/mates/listing/${listing.id}`,
        }}
        title="Sign in to contact the owner"
      />
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="font-display text-lg mt-0.5 truncate">{value}</div>
  </div>
);

export default MateListing;
