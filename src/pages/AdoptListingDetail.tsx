import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, BadgeCheck, ShieldCheck, FileText, AlertTriangle, ArrowRightLeft, Lock, Heart } from "lucide-react";
import { ReportButton } from "@/components/ReportButton";
import { useSeo } from "@/hooks/useSeo";
import { SellerBadge } from "@/components/SellerBadge";
import { BredOnPetosRibbon } from "@/components/BredOnPetosRibbon";
import { PhotoGallery } from "@/components/PhotoGallery";
import { LineageTree } from "@/components/LineageTree";
import { HealthTestRail } from "@/components/marketplace/HealthTestChip";
import { StartTransferSheet, TransferStatusCard } from "@/components/TransferSheet";
import { PayDepositSheet } from "@/components/marketplace/PayDepositSheet";
import { useAuth } from "@/hooks/useAuth";
import { SmartImage } from "@/components/SmartImage";
import { AdoptionApplicationSheet } from "@/components/adopt/AdoptionApplicationSheet";
import { SponsorSheet } from "@/components/sponsor/SponsorSheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TYPE_LABEL: Record<string, string> = { adoption: "Adoption", rehoming: "Rehoming", breeder_sale: "Breeder sale" };
const TYPE_TONE: Record<string, string> = {
  adoption: "bg-leaf/15 text-leaf border-leaf/30",
  rehoming: "bg-coral/15 text-coral border-coral/30",
  breeder_sale: "bg-sky/15 text-sky border-sky/30",
};

const AdoptListingDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [sponsorOpen, setSponsorOpen] = useState(false);

  const { data: listing, isLoading } = useQuery({
    queryKey: ["pet-listing", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("pet_listings").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: sellerInfo } = useQuery({
    queryKey: ["pet-listing-seller", listing?.owner_id],
    enabled: !!listing?.owner_id,
    queryFn: async () => {
      const ownerId = listing!.owner_id;
      const [{ data: profile }, { data: org }, { count }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, account_type, breeder_verified").eq("id", ownerId).maybeSingle(),
        supabase.from("org_profiles").select("user_id, org_name, status").eq("user_id", ownerId).eq("status", "approved").maybeSingle(),
        supabase.from("pet_listings").select("id", { count: "exact", head: true })
          .eq("owner_id", ownerId).eq("active", true).eq("status", "active")
          .in("listing_type", ["rehoming", "breeder_sale"]),
      ]);
      return { profile, org, activeSaleCount: count ?? 0 };
    },
  });

  const { data: coListShelter } = useQuery({
    queryKey: ["colist-shelter-detail", (listing as any)?.co_listed_with_org_id],
    enabled: !!(listing as any)?.co_listed_with_org_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("org_profiles")
        .select("user_id, org_name, city")
        .eq("user_id", (listing as any).co_listed_with_org_id)
        .maybeSingle();
      return data as { user_id: string; org_name: string; city: string | null } | null;
    },
  });

  const { data: moreFromSeller } = useQuery({
    queryKey: ["more-from-seller", listing?.owner_id, listing?.id],
    enabled: !!listing?.owner_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("pet_listings")
        .select("id, title, photos, fee_inr, listing_type")
        .eq("owner_id", listing!.owner_id)
        .eq("active", true)
        .eq("status", "active")
        .neq("id", listing!.id)
        .limit(8);
      return data ?? [];
    },
  });

  useSeo({
    title: listing?.title ?? "Pet listing",
    description: listing?.description?.slice(0, 150) ?? "Adopt or rehome a pet.",
  });

  if (isLoading) return <div className="container-app pt-10 text-center text-muted-foreground">Loading…</div>;
  if (!listing) return <div className="container-app pt-10 text-center text-muted-foreground">Listing not found</div>;

  const photos: string[] = Array.isArray(listing.photos) ? (listing.photos as string[]) : [];
  const isFree = listing.listing_type === "adoption" || !listing.fee_inr;
  const isOwner = !!user && user.id === listing.owner_id;
  const isSold = listing.status === "sold";
  const sellerKind = sellerInfo?.profile?.account_type as string | undefined;
  const isShelterSeller = sellerKind === "shelter" || sellerKind === "sanctuary" || sellerKind === "rescuer";
  const canSponsor = sellerKind === "sanctuary" || sellerKind === "shelter" || sellerKind === "rescuer";

  const contact = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { nav("/auth"); return; }
    if (u.user.id === listing.owner_id) return;
    // Find or create a 1:1 conversation
    const { data: existing } = await supabase
      .from("conversation_members")
      .select("conversation_id, conversations!inner(is_group)")
      .eq("user_id", u.user.id);
    let convId: string | null = null;
    for (const row of existing ?? []) {
      if ((row as any).conversations?.is_group) continue;
      const { data: members } = await supabase.from("conversation_members").select("user_id").eq("conversation_id", row.conversation_id);
      const ids = (members ?? []).map((m) => m.user_id);
      if (ids.length === 2 && ids.includes(listing.owner_id)) { convId = row.conversation_id; break; }
    }
    if (!convId) {
      const { data: c, error } = await supabase.from("conversations").insert({ created_by: u.user.id, is_group: false }).select("id").single();
      if (error || !c) return;
      convId = c.id;
      await supabase.from("conversation_members").insert([
        { conversation_id: convId, user_id: u.user.id },
        { conversation_id: convId, user_id: listing.owner_id },
      ]);
    }
    nav(`/messages/${convId}`);
  };

  return (
    <div className="container-app pt-4 pb-24 max-w-lg">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <PhotoGallery photos={photos} alt={listing.title} />

      <div className="flex items-start justify-between gap-2 mb-2">
        <h1 className="font-display text-2xl leading-tight">{listing.title}</h1>
        <Badge className={`border ${TYPE_TONE[listing.listing_type]} gap-1`}>
          {listing.listing_type === "breeder_sale" && <BadgeCheck className="h-3 w-3" />}
          {TYPE_LABEL[listing.listing_type]}
        </Badge>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <SellerBadge
          type={(listing.seller_type as any) ?? sellerInfo?.profile?.account_type ?? "pet_parent"}
          verified={!!sellerInfo?.profile?.breeder_verified}
        />
        {sellerInfo?.org && (
          <Link to={`/org/${sellerInfo.org.user_id}`} className="text-xs underline text-muted-foreground">
            {sellerInfo.org.org_name}
          </Link>
        )}
        {!sellerInfo?.org && sellerInfo?.profile?.full_name && (
          <Link to={`/u/${sellerInfo.profile.id}`} className="text-xs underline text-muted-foreground">
            {sellerInfo.profile.full_name}
          </Link>
        )}
      </div>

      {listing.bred_on_petos && (
        <div className="mb-3"><BredOnPetosRibbon litterId={listing.litter_id} /></div>
      )}

      {coListShelter && (
        <Card className="rounded-2xl bg-leaf/5 border-leaf/30 p-3 mb-3 flex items-center gap-2 text-[12px]">
          <BadgeCheck className="h-4 w-4 text-leaf shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-muted-foreground">Co-listed with </span>
            <Link to={`/org/${coListShelter.user_id}`} className="font-semibold underline">
              {coListShelter.org_name}
            </Link>
            {coListShelter.city && <span className="text-muted-foreground"> · {coListShelter.city}</span>}
          </div>
        </Card>
      )}

      {listing.pet_id && <LineageTree petId={listing.pet_id} />}

      <TransferStatusCard listingId={listing.id} />

      {sellerInfo?.profile?.account_type === "pet_parent" && (sellerInfo?.activeSaleCount ?? 0) > 2 && (
        <Card className="rounded-2xl bg-amber-500/10 border-amber-500/30 p-3 mb-3 flex gap-2 text-[12px]">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <span>Repeat seller: this pet parent has {sellerInfo.activeSaleCount} active sale listings. Verified breeders are recommended for purchases.</span>
        </Card>
      )}

      <div className="text-sm text-muted-foreground mb-3">
        {[listing.breed ?? listing.species, listing.gender, listing.age_weeks ? `${Math.floor(listing.age_weeks / 4)} months` : null].filter(Boolean).join(" · ")}
      </div>

      <div className="flex items-center gap-3 mb-4 text-sm">
        {listing.city && <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4" />{listing.city}</span>}
        <span className="ml-auto font-display text-lg">{isFree ? <span className="text-leaf">Free</span> : <span className="text-primary">₹{listing.fee_inr.toLocaleString("en-IN")}</span>}</span>
      </div>

      {listing.description && (
        <Card className="rounded-2xl border-hairline p-4 mb-3">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{listing.description}</p>
        </Card>
      )}

      <Card className="rounded-2xl border-hairline p-4 mb-3 space-y-2">
        {listing.vaccination_doc_url && (
          <a href={listing.vaccination_doc_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-leaf">
            <ShieldCheck className="h-4 w-4" /> Vaccination record <FileText className="h-3 w-3 opacity-60" />
          </a>
        )}
        {listing.breeder_cert_url && (
          <a href={listing.breeder_cert_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-sky">
            <BadgeCheck className="h-4 w-4" /> Breeder certificate <FileText className="h-3 w-3 opacity-60" />
          </a>
        )}
        {listing.microchip_id && <div className="text-sm text-muted-foreground">Microchip: <span className="font-mono">{listing.microchip_id}</span></div>}
        {(listing.parents_info as any)?.notes && (
          <div className="text-sm text-muted-foreground">Parents: {(listing.parents_info as any).notes}</div>
        )}
        {Array.isArray((listing as any).health_tests) && (listing as any).health_tests.length > 0 && (
          <div className="pt-1">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Health screening</div>
            <HealthTestRail entries={(listing as any).health_tests} max={20} />
          </div>
        )}
      </Card>

      <Card className="rounded-2xl bg-amber-500/10 border-amber-500/30 p-3 mb-4 flex gap-2 text-[12px] leading-relaxed">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <span>Always meet the pet in person before paying. Never wire money. Verify documents on site.</span>
      </Card>

      {isOwner ? (
        <div className="flex gap-2">
          <Button
            onClick={() => setTransferOpen(true)}
            disabled={isSold || !listing.pet_id}
            className="flex-1 rounded-xl h-12 gap-2"
          >
            <ArrowRightLeft className="h-4 w-4" /> {isSold ? "Sold" : "Transfer to buyer"}
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          {isShelterSeller ? (
            <Button onClick={() => setApplyOpen(true)} disabled={isSold} className="flex-1 rounded-xl h-12">
              {isSold ? "No longer available" : "Apply to adopt"}
            </Button>
          ) : (
            <Button onClick={() => setConfirmOpen(true)} disabled={isSold} className="flex-1 rounded-xl h-12">
              {isSold ? "No longer available" : "Contact owner"}
            </Button>
          )}
          <ReportButton subjectType="listing" subjectId={listing.id} />
        </div>
      )}

      {/* Holding-deposit checkout — only for paid breeder sale listings, non-owners */}
      {!isOwner && !isSold && listing.listing_type === "breeder_sale" && !!listing.fee_inr && listing.fee_inr > 0 && (
        <Button
          variant="outline"
          onClick={() => setDepositOpen(true)}
          className="w-full rounded-xl h-12 mt-2 gap-2 border-primary/40 text-primary hover:bg-primary/5"
        >
          <Lock className="h-4 w-4" /> Reserve with deposit
        </Button>
      )}

      {/* Sponsor monthly — only for sanctuary/shelter/rescuer-owned animals */}
      {!isOwner && canSponsor && (
        <Button
          variant="outline"
          onClick={() => setSponsorOpen(true)}
          className="w-full rounded-xl h-12 mt-2 gap-2 border-coral/40 text-coral hover:bg-coral/5"
        >
          <Heart className="h-4 w-4" fill="currentColor" /> Sponsor monthly
        </Button>
      )}

      <SponsorSheet
        open={sponsorOpen}
        onOpenChange={setSponsorOpen}
        orgUserId={listing.owner_id}
        listingId={listing.id}
        listingTitle={listing.title}
      />

      <PayDepositSheet
        open={depositOpen}
        onOpenChange={setDepositOpen}
        listingId={listing.id}
        listingTitle={listing.title ?? "puppy"}
        fullPriceInr={listing.fee_inr ?? 0}
      />

      {!!moreFromSeller?.length && (
        <div className="mt-8">
          <h2 className="font-display text-lg mb-3">More from this seller</h2>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2">
            {moreFromSeller.map((m: any) => {
              const p = Array.isArray(m.photos) && m.photos.length ? m.photos[0] : null;
              return (
                <button
                  key={m.id}
                  onClick={() => nav(`/mates/adopt/${m.id}`)}
                  className="shrink-0 w-32 text-left rounded-2xl border border-hairline bg-card overflow-hidden"
                >
                  <div className="aspect-square bg-muted">
                    {p ? <SmartImage src={p} alt={m.title} aspect="1/1" className="w-full h-full" /> : null}
                  </div>
                  <div className="p-2">
                    <div className="text-xs font-medium truncate">{m.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {m.listing_type === "adoption" || !m.fee_inr ? "Free" : `₹${m.fee_inr.toLocaleString("en-IN")}`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isOwner && (
        <StartTransferSheet
          listing={{ id: listing.id, owner_id: listing.owner_id, pet_id: listing.pet_id, fee_inr: listing.fee_inr, title: listing.title }}
          open={transferOpen}
          onOpenChange={setTransferOpen}
        />
      )}

      <AdoptionApplicationSheet
        open={applyOpen}
        onOpenChange={setApplyOpen}
        shelterId={listing.owner_id}
        listingId={listing.id}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bringing a pet home is a 10–15 year commitment</AlertDialogTitle>
            <AlertDialogDescription>
              Please make sure you can provide food, vet care, exercise, training and time for this pet's full life. Continue only if you're sure.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction onClick={contact}>I'm sure, contact owner</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdoptListingDetail;