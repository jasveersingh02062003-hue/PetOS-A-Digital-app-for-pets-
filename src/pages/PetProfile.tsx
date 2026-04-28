import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PostGrid } from "@/components/social/PostGrid";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Cake, Heart, MapPin, Share2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useSeo } from "@/hooks/useSeo";
import { jsonLd } from "@/lib/seo";

const PetProfile = () => {
  const { publicId } = useParams<{ publicId: string }>();
  const nav = useNavigate();

  const { data: pet, isLoading } = useQuery({
    queryKey: ["pet-by-public", publicId],
    enabled: !!publicId,
    queryFn: async () => {
      // 1. Try the owner-only direct read first (full row, includes private fields when viewer = owner)
      const { data: byPub } = await supabase.from("pets").select("*").eq("public_id", publicId!).maybeSingle();
      if (byPub) return byPub;
      const { data: byId } = await supabase.from("pets").select("*").eq("id", publicId!).maybeSingle();
      if (byId) return byId;

      // 2. Fall back to the public RPC so visitors can view other people's pets.
      //    RLS hides direct row access from non-owners; get_pets_public is SECURITY DEFINER
      //    and returns a safe subset (no DOB/microchip/insurance/lat/lng).
      const { data: all } = await supabase.rpc("get_pets_public");
      const list = (all ?? []) as any[];
      return (
        list.find((p) => p.public_id === publicId) ??
        list.find((p) => p.id === publicId) ??
        null
      );
    },
  });


  const { data: owner } = useQuery({
    queryKey: ["pet-owner", pet?.owner_id],
    enabled: !!pet?.owner_id,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_profiles_public");
      return (data ?? []).find((p: any) => p.id === pet!.owner_id) ?? null;
    },
  });

  const share = async () => {
    const url = `${window.location.origin}/pet/${pet?.public_id ?? pet?.id}`;
    try {
      if (navigator.share) await navigator.share({ url, title: pet?.name });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch {}
  };

  const ageYrs = pet?.date_of_birth ? Math.floor((Date.now() - new Date(pet.date_of_birth).getTime()) / 31557600000) : null;

  const petUrl = pet ? `${window.location.origin}/pet/${pet.public_id ?? pet.id}` : "";
  useSeo(
    pet
      ? {
          title: `${pet.name}${pet.breed ? ` · ${pet.breed}` : ""}`,
          description:
            pet.bio?.slice(0, 155) ||
            `Meet ${pet.name} on Petos${pet.city ? ` from ${pet.city}` : ""}.`,
          image: pet.avatar_url ?? undefined,
          canonical: petUrl,
          type: "profile",
          jsonLd: [
            {
              "@context": "https://schema.org",
              "@type": "Person",
              name: pet.name,
              image: pet.avatar_url ?? undefined,
              url: petUrl,
              description: pet.bio ?? undefined,
            },
            jsonLd.breadcrumb([
              { name: "Petos", url: window.location.origin },
              { name: "Pets", url: `${window.location.origin}/discover` },
              { name: pet.name, url: petUrl },
            ]),
          ],
        }
      : { title: "Pet", noIndex: true },
  );

  if (isLoading) return <div className="container-app pad-top-safe pt-10 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!pet) return <div className="container-app pad-top-safe pt-10 text-center text-sm text-muted-foreground">Pet not found</div>;

  return (
    <div className="container-app pad-top-safe pb-20">
      <header className="pt-4 pb-2 flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-lg flex-1 truncate">{pet.name}</h1>
        <Button variant="ghost" size="icon" className="rounded-full" onClick={share}>
          <Share2 className="h-5 w-5" />
        </Button>
      </header>

      <div className="flex flex-col items-center text-center mb-4">
        <Avatar className="h-28 w-28 mb-3 ring-4 ring-primary-soft">
          <AvatarImage src={pet.avatar_url ?? undefined} />
          <AvatarFallback className="bg-primary-soft text-primary font-display text-4xl">{pet.name[0]}</AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-2">
          <h2 className="font-display text-2xl">{pet.name}</h2>
          {pet.vaccination_verified && <ShieldCheck className="h-5 w-5 text-primary" />}
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          {[pet.breed, pet.gender].filter(Boolean).join(" · ")}
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          {ageYrs != null && <span className="flex items-center gap-1"><Cake className="h-3.5 w-3.5" /> {ageYrs}y</span>}
          {pet.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {pet.city}</span>}
        </div>
      </div>

      {owner && (
        <Link to={`/u/${owner.id}`} className="block">
          <Card className="rounded-2xl border-hairline shadow-none p-3 flex items-center gap-3 mb-4 hover:bg-muted/40">
            <Avatar className="h-9 w-9">
              <AvatarImage src={owner.avatar_url ?? undefined} />
              <AvatarFallback className="text-sm bg-primary-soft text-primary">{owner.full_name?.[0] ?? "·"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Owned by</div>
              <div className="text-sm font-medium truncate">{owner.full_name ?? "Pet parent"}</div>
            </div>
          </Card>
        </Link>
      )}

      {pet.bio && <p className="text-sm leading-relaxed mb-4">{pet.bio}</p>}

      {pet.discoverable_for_mating && (
        <Button onClick={() => nav("/mates/new")} variant="outline" className="w-full rounded-xl border-hairline mb-4 gap-2">
          <Heart className="h-4 w-4 text-primary" /> Available for mating
        </Button>
      )}

      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 mt-4">Posts</div>
      <PostGrid petId={pet.id} />
    </div>
  );
};

export default PetProfile;
