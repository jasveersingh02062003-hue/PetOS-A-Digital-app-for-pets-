import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PostGrid } from "@/components/social/PostGrid";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Cake, Heart, MapPin, Share2, ShieldCheck, Grid3x3, GitBranch, Stethoscope, Award, BadgeCheck, FileText, Tag, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useSeo } from "@/hooks/useSeo";
import { jsonLd } from "@/lib/seo";
import { AchievementChips } from "@/components/social/AchievementChips";
import { format } from "date-fns";

const PetProfile = () => {
  const { publicId } = useParams<{ publicId: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

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

  // Lineage: sire + dam + littermates + offspring
  const { data: lineage } = useQuery({
    queryKey: ["pet-lineage", pet?.id],
    enabled: !!pet?.id,
    queryFn: async () => {
      const { data: all } = await supabase.rpc("get_pets_public");
      const list = (all ?? []) as any[];
      const findById = (id?: string | null) => (id ? list.find((p) => p.id === id) ?? null : null);
      return {
        sire: findById(pet!.sire_pet_id),
        dam: findById(pet!.dam_pet_id),
        offspring: list.filter((p) => p.sire_pet_id === pet!.id || p.dam_pet_id === pet!.id),
      };
    },
  });

  // Health summary (only owner can read full data; this gracefully empties for visitors)
  const { data: health } = useQuery({
    queryKey: ["pet-health-summary", pet?.id],
    enabled: !!pet?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("health_records")
        .select("id, record_type, title, occurred_on")
        .eq("pet_id", pet!.id)
        .order("occurred_on", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  // Post count for stats
  const { data: postCount } = useQuery({
    queryKey: ["pet-post-count", pet?.id],
    enabled: !!pet?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("pet_id", pet!.id);
      return count ?? 0;
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

  const isOwner = !!(user && pet && pet.owner_id === user.id);

  const updatePet = async (patch: Record<string, any>) => {
    if (!pet) return;
    const { error } = await supabase.from("pets").update(patch).eq("id", pet.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["pet-by-public", publicId] });
    toast.success("Updated");
  };

  const toggleStud = async (v: boolean) => {
    await updatePet({
      discoverable_for_mating: v,
      status_chip: v
        ? "available_for_stud"
        : pet?.status_chip === "available_for_stud"
          ? null
          : pet?.status_chip,
    });
  };

  const toggleForSale = async (v: boolean) => {
    await updatePet({
      status_chip: v
        ? "for_sale"
        : pet?.status_chip === "for_sale"
          ? null
          : pet?.status_chip,
    });
  };

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

  const cover = pet.cover_url ?? pet.avatar_url;
  const bredOnPetos = !!(pet.sire_pet_id && pet.dam_pet_id);

  return (
    <div className="pb-20">
      {/* Cover */}
      <div className="relative h-48 sm:h-64 bg-gradient-to-br from-primary-soft to-muted overflow-hidden">
        {cover && (
          <img src={cover} alt={pet.name} className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-background/60" />
        <div className="absolute top-0 inset-x-0 pad-top-safe">
          <div className="container-app pt-3 flex items-center justify-between">
            <Button variant="secondary" size="icon" className="rounded-full bg-background/80 backdrop-blur" onClick={() => nav(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Button variant="secondary" size="icon" className="rounded-full bg-background/80 backdrop-blur" onClick={share}>
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="container-app -mt-12 relative">
        {/* Avatar + name */}
        <div className="flex items-end gap-4 mb-3">
          <Avatar className="h-24 w-24 ring-4 ring-background shadow-lg">
            <AvatarImage src={pet.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary-soft text-primary font-display text-3xl">{pet.name[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 pb-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl truncate">{pet.name}</h1>
              {pet.vaccination_verified && <ShieldCheck className="h-5 w-5 text-primary shrink-0" />}
              {bredOnPetos && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-leaf/15 text-leaf border border-leaf/30 px-1.5 py-0.5 rounded-full">
                  <BadgeCheck className="h-3 w-3" /> Bred on PetOS
                </span>
              )}
            </div>
            <div className="text-sm text-muted-foreground truncate">
              {[pet.breed, pet.gender].filter(Boolean).join(" · ") || "—"}
            </div>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3 flex-wrap">
          {ageYrs != null && <span className="flex items-center gap-1"><Cake className="h-3.5 w-3.5" /> {ageYrs}y</span>}
          {pet.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {pet.city}</span>}
          {pet.status_chip && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{pet.status_chip}</span>}
        </div>

        {/* Stats — IG style */}
        <div className="grid grid-cols-3 gap-2 mb-4 py-3 border-y border-hairline">
          <Stat n={postCount ?? 0} label="Posts" />
          <Stat n={(lineage?.offspring.length ?? 0)} label="Offspring" />
          <Stat n={(health?.length ?? 0)} label="Records" />
        </div>

        {/* Bio */}
        {pet.bio && <p className="text-sm leading-relaxed mb-3 whitespace-pre-wrap">{pet.bio}</p>}

        {/* Owner pill */}
        {owner && (
          <Link to={`/u/${owner.handle ?? owner.id}`} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/60 hover:bg-muted mb-4 text-xs">
            <Avatar className="h-5 w-5">
              <AvatarImage src={owner.avatar_url ?? undefined} />
              <AvatarFallback className="text-[10px] bg-primary-soft text-primary">{owner.full_name?.[0] ?? "·"}</AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground">Owned by</span>
            <span className="font-medium">{owner.full_name ?? "Pet parent"}</span>
          </Link>
        )}

        {pet.discoverable_for_mating && (
          <Button onClick={() => nav("/mates/new")} variant="outline" className="w-full rounded-xl border-hairline mb-4 gap-2">
            <Heart className="h-4 w-4 text-primary" /> Available for mating
          </Button>
        )}

        {/* Owner-only inline controls */}
        {isOwner && (
          <div className="rounded-2xl border border-hairline bg-card/50 p-3 mb-4 space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Owner controls
            </div>
            <div className="flex items-center justify-between gap-3 py-1.5">
              <div className="min-w-0">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5 text-primary" /> Available for stud
                </div>
                <div className="text-[11px] text-muted-foreground">Show on Find a mate.</div>
              </div>
              <Switch
                checked={!!pet.discoverable_for_mating || pet.status_chip === "available_for_stud"}
                onCheckedChange={toggleStud}
              />
            </div>
            <div className="flex items-center justify-between gap-3 py-1.5 border-t border-hairline">
              <div className="min-w-0">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-primary" /> Listed for sale
                </div>
                <div className="text-[11px] text-muted-foreground">Marks profile, doesn't create a listing.</div>
              </div>
              <Switch
                checked={pet.status_chip === "for_sale"}
                onCheckedChange={toggleForSale}
              />
            </div>
            {pet.status_chip === "for_sale" && (
              <Button
                size="sm"
                variant="outline"
                className="w-full rounded-xl border-hairline mt-1 gap-1.5"
                onClick={() => nav(`/mates/adopt/new?pet=${pet.id}`)}
              >
                <Tag className="h-3.5 w-3.5" /> Create adopt/sale listing
              </Button>
            )}
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="posts" className="mt-2">
          <TabsList className="grid grid-cols-4 w-full bg-transparent border-b border-hairline rounded-none h-auto p-0">
            <TabsTrigger value="posts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2">
              <Grid3x3 className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="lineage" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2">
              <GitBranch className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="health" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2">
              <Stethoscope className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="achievements" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2">
              <Award className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-3">
            <PostGrid petId={pet.id} />
          </TabsContent>

          <TabsContent value="lineage" className="mt-4 space-y-4">
            <LineageBlock title="Parents">
              <div className="grid grid-cols-2 gap-2">
                <PetMini label="Sire" pet={lineage?.sire} />
                <PetMini label="Dam" pet={lineage?.dam} />
              </div>
            </LineageBlock>
            <LineageBlock title={`Offspring (${lineage?.offspring.length ?? 0})`}>
              {lineage?.offspring.length ? (
                <div className="grid grid-cols-3 gap-2">
                  {lineage.offspring.map((p) => <PetMini key={p.id} pet={p} />)}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground py-4 text-center">No recorded offspring.</div>
              )}
            </LineageBlock>
          </TabsContent>

          <TabsContent value="health" className="mt-3">
            {health?.length ? (
              <div className="space-y-2">
                {health.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-hairline">
                    <div className="h-8 w-8 rounded-full bg-primary-soft text-primary flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{r.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {r.record_type} · {format(new Date(r.occurred_on), "MMM d, yyyy")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <Stethoscope className="h-6 w-6 mx-auto mb-2 opacity-50" />
                No public health records.
              </div>
            )}
          </TabsContent>

          <TabsContent value="achievements" className="mt-4">
            {pet.owner_id && <AchievementChips userId={pet.owner_id} />}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

const Stat = ({ n, label }: { n: number; label: string }) => (
  <div className="text-center">
    <div className="font-display text-lg leading-none">{n}</div>
    <div className="text-[11px] text-muted-foreground mt-1">{label}</div>
  </div>
);

const LineageBlock = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
    {children}
  </div>
);

const PetMini = ({ pet, label }: { pet?: any; label?: string }) => {
  if (!pet) {
    return (
      <div className="rounded-xl border border-dashed border-hairline p-3 text-center text-xs text-muted-foreground">
        {label ? `${label} unknown` : "Unknown"}
      </div>
    );
  }
  return (
    <Link to={`/pet/${pet.public_id ?? pet.id}`} className="rounded-xl border border-hairline p-2 flex flex-col items-center gap-1 hover:bg-muted/40">
      <Avatar className="h-12 w-12">
        <AvatarImage src={pet.avatar_url ?? undefined} />
        <AvatarFallback className="bg-primary-soft text-primary text-sm">{pet.name?.[0] ?? "·"}</AvatarFallback>
      </Avatar>
      {label && <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>}
      <div className="text-xs font-medium truncate w-full text-center">{pet.name}</div>
    </Link>
  );
};

export default PetProfile;
