import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Globe, Phone, Heart, Copy, HandHeart, Inbox, PawPrint, Sparkles } from "lucide-react";
import { SellerBadge } from "@/components/SellerBadge";
import { useSeo } from "@/hooks/useSeo";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { LittersList } from "@/components/profile/LittersList";
import { BoardingList } from "@/components/profile/BoardingList";
import { AdoptionApplicationSheet } from "@/components/adopt/AdoptionApplicationSheet";
import { ReviewsList, RatingChip } from "@/components/reviews/ReviewsList";
import { DonateDialog } from "@/components/donations/DonateDialog";
import { getRoleBanner } from "@/lib/roleTheme";
import { MatesGrid } from "@/components/profile/MatesGrid";

const OrgProfile = () => {
  const { userId } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const isOwner = !!user && user.id === userId;
  const [volunteerOpen, setVolunteerOpen] = useState(false);

  const { data: org, isLoading } = useQuery({
    queryKey: ["org-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("org_profiles").select("*").eq("user_id", userId!).maybeSingle();
      return data;
    },
  });

  const { data: listings } = useQuery({
    queryKey: ["org-listings", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("pet_listings")
        .select("id, title, photos, listing_type")
        .eq("owner_id", userId!).eq("active", true).eq("status", "active").limit(20);
      return data ?? [];
    },
  });

  useSeo({ title: org?.org_name ?? "Organisation", description: org?.description?.slice(0, 150) });

  if (isLoading) return <div className="container-app pt-10 text-center text-muted-foreground">Loading…</div>;
  if (!org || org.status !== "approved")
    return <div className="container-app pt-10 text-center text-muted-foreground">Organisation not found or not yet verified.</div>;

  const cover = (org.facility_photos ?? [])[0];
  const isZoo = org.org_type === "zoo";
  const isSanctuary = org.org_type === "sanctuary";
  const hidesMarketplace = isZoo || isSanctuary;
  const hasDonation = !!(org.donation_upi || org.donation_url);
  const canReceiveDonations = ["shelter", "sanctuary", "rescuer", "ngo"].includes(
    String(org.org_type),
  );
  const roleBanner = getRoleBanner(org.org_type as any);

  return (
    <div className="container-app pt-4 pb-24 max-w-lg">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className={`aspect-[16/9] rounded-2xl overflow-hidden mb-4 relative ${roleBanner}`}>
        {cover ? (
          <img src={cover} alt={org.org_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full" aria-hidden />
        )}
      </div>

      <div className="flex items-start justify-between gap-2 mb-2">
        <h1 className="font-display text-2xl leading-tight">{org.org_name}</h1>
        <SellerBadge type={org.org_type} verified />
      </div>

      <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3 flex-wrap">
        {org.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{org.city}</span>}
        {org.website && <a href={org.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 underline"><Globe className="h-3 w-3" />Website</a>}
        {org.phone && <a href={`tel:${org.phone}`} className="flex items-center gap-1"><Phone className="h-3 w-3" />{org.phone}</a>}
        {userId && <RatingChip subjectType="provider" subjectId={userId} />}
      </div>

      {org.description && (
        <Card className="rounded-2xl border-hairline p-4 mb-3">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{org.description}</p>
        </Card>
      )}

      {isZoo && (
        <Card className="rounded-2xl bg-sky/10 border-sky/30 p-4 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <PawPrint className="h-4 w-4 text-sky" /> <div className="font-display text-base">Symbolically adopt an animal</div>
          </div>
          <p className="text-[12px] text-muted-foreground mb-3">
            Sponsor the daily care, food and medical needs of the animals at {org.org_name}. This is a donation — animals stay safe at the wildlife centre and are not transferred.
          </p>
          {!hasDonation && isOwner && (
            <Button onClick={() => nav("/onboarding/org")} variant="outline" className="w-full rounded-xl">
              <Sparkles className="h-4 w-4 mr-1" /> Add donation details to enable sponsorship
            </Button>
          )}
          {!hasDonation && !isOwner && (
            <p className="text-[12px] text-muted-foreground italic">Sponsorship details coming soon.</p>
          )}
        </Card>
      )}

      {hasDonation && (
        <Card className="rounded-2xl bg-coral/10 border-coral/30 p-4 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="h-4 w-4 text-coral" />
            <div className="font-display text-base">{isZoo ? "Sponsor an animal" : "Support our work"}</div>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">UPI / external donations go directly to {org.org_name}.</p>
          {org.donation_upi && (
            <div className="space-y-2 mb-2">
              <Button
                asChild
                className="w-full rounded-xl bg-coral hover:bg-coral/90 text-white"
              >
                <a href={`upi://pay?pa=${encodeURIComponent(org.donation_upi)}&pn=${encodeURIComponent(org.org_name)}&cu=INR`}>
                  <Heart className="h-4 w-4 mr-1" /> {isZoo ? "Sponsor via UPI" : "Donate via UPI"}
                </a>
              </Button>
              <button
                onClick={() => { navigator.clipboard.writeText(org.donation_upi!); toast.success("UPI copied"); }}
                className="w-full text-left rounded-xl bg-card p-2.5 flex items-center justify-between text-xs border border-hairline"
              >
                <span><span className="text-muted-foreground">UPI ID: </span><span className="font-mono">{org.donation_upi}</span></span>
                <Copy className="h-3 w-3" />
              </button>
            </div>
          )}
          {org.donation_url && (
            <Button asChild variant="outline" className="w-full rounded-xl">
              <a href={org.donation_url} target="_blank" rel="noreferrer">{isZoo ? "Sponsor online" : "Donate online"}</a>
            </Button>
          )}
        </Card>
      )}

      {canReceiveDonations && userId && !isOwner && (
        <Card className="rounded-2xl bg-primary-soft/40 border-primary/20 p-4 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="h-4 w-4 text-primary" />
            <div className="font-display text-base">Donate via PetOS</div>
          </div>
          {(org.donor_count ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground mb-3">
              ₹{(org.total_donations_inr ?? 0).toLocaleString("en-IN")} raised from{" "}
              {org.donor_count} donor{org.donor_count === 1 ? "" : "s"} on PetOS
            </p>
          )}
          <DonateDialog
            orgUserId={userId}
            orgName={org.org_name}
            trigger={
              <Button className="w-full rounded-xl bg-primary hover:bg-primary/90">
                <Heart className="h-4 w-4 mr-1" /> Donate securely
              </Button>
            }
          />
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Secure card / UPI checkout • Email receipt
          </p>
        </Card>
      )}

      {canReceiveDonations && isOwner && (
        <Card className="rounded-2xl border-hairline p-4 mb-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Total raised on PetOS</div>
            <div className="font-display text-xl">
              ₹{(org.total_donations_inr ?? 0).toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {org.donor_count ?? 0} donor{org.donor_count === 1 ? "" : "s"}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => nav("/org/donations")}>
            View
          </Button>
        </Card>
      )}

      {org.org_type === "shelter" || org.org_type === "sanctuary" || org.org_type === "rescuer" ? (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Button onClick={() => setVolunteerOpen(true)} variant="outline" className="rounded-xl gap-1.5">
            <HandHeart className="h-4 w-4 text-coral" /> Volunteer
          </Button>
          <Button onClick={() => nav("/messages")} variant="outline" className="rounded-xl">
            Contact
          </Button>
          {isOwner && (
            <Button onClick={() => nav("/adoption-inbox")} variant="outline" className="rounded-xl gap-1.5 col-span-2">
              <Inbox className="h-4 w-4" /> Adoption inbox
            </Button>
          )}
        </div>
      ) : null}

      {!hidesMarketplace && !!listings?.length && (
        <>
          <h2 className="font-display text-lg mb-2">Available pets</h2>
          <div className="grid grid-cols-2 gap-3">
            {listings.map((l: any) => {
              const photo = Array.isArray(l.photos) && l.photos.length ? l.photos[0] : null;
              return (
                <button key={l.id} onClick={() => nav(`/mates/adopt/${l.id}`)} className="text-left rounded-2xl border border-hairline overflow-hidden bg-card">
                  <div className="aspect-square bg-muted">{photo && <img src={photo} alt="" className="w-full h-full object-cover" />}</div>
                  <div className="p-2 text-sm truncate">{l.title}</div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {(org.org_type === "breeder" || org.org_type === "kennel") && userId && (
        <div className="mt-6">
          <h2 className="font-display text-lg mb-2">Litters</h2>
          <LittersList userId={userId} />
        </div>
      )}

      {org.org_type === "breeder" && userId && (
        <div className="mt-6">
          <h2 className="font-display text-lg mb-2">Available for mating</h2>
          <MatesGrid ownerId={userId} />
        </div>
      )}

      {(org.org_type === "breeder" || org.org_type === "kennel") && userId && (
        <div className="mt-6">
          <h2 className="font-display text-lg mb-2">Boarding & services</h2>
          <BoardingList userId={userId} isOwner={isOwner} />
        </div>
      )}

      {userId && (
        <div className="mt-6">
          <h2 className="font-display text-lg mb-2">Reviews</h2>
          <ReviewsList subjectType="provider" subjectId={userId} />
        </div>
      )}

      {userId && (
        <AdoptionApplicationSheet
          open={volunteerOpen}
          onOpenChange={setVolunteerOpen}
          shelterId={userId}
          isVolunteer
        />
      )}
    </div>
  );
};

export default OrgProfile;