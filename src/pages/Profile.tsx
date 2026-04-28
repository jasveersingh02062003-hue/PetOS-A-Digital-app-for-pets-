import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, usePets } from "@/hooks/useProfile";
import { useTier } from "@/hooks/useTier";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  LogOut, Settings, Plus, AlertTriangle, ShieldCheck, ChevronRight, Search,
  Camera, Share2, Edit3, Grid3x3, Tag as TagIcon, PawPrint, Heart,
} from "lucide-react";
import { PlusBadge } from "@/components/PlusBadge";
import { MissingCreateSheet } from "@/components/MissingCreateSheet";
import { SmartImage } from "@/components/SmartImage";
import { ProfileSkeleton } from "@/components/skeletons/FeedSkeleton";
import { SellerBadge } from "@/components/SellerBadge";
import { PostGrid } from "@/components/social/PostGrid";
import { uploadImageWithVariants } from "@/lib/uploadImage";
import { toast } from "sonner";
import { differenceInMonths, differenceInYears } from "date-fns";

const Profile = () => {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { data: pets } = usePets();
  const { data: tier } = useTier();
  const [isStaff, setIsStaff] = useState(false);
  const [reportingPet, setReportingPet] = useState<any | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const initialLoading = !profile && !pets;
  const isBuyer = (profile as any)?.account_type === "buyer";
  const accountType = (profile as any)?.account_type ?? "pet_parent";
  const lookingFor = (profile as any)?.looking_for as
    | { species?: string[] | null; breed?: string | null; city?: string | null; max_price_inr?: number | null }
    | null
    | undefined;
  const handle = (profile as any)?.handle as string | null | undefined;
  const coverUrl = (profile as any)?.cover_url as string | null | undefined;

  const { data: counts } = useQuery({
    queryKey: ["profile-counts", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const [posts, followers, following] = await Promise.all([
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", user!.id),
        supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", user!.id),
        supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", user!.id),
      ]);
      return {
        posts: posts.count ?? 0,
        followers: followers.count ?? 0,
        following: following.count ?? 0,
      };
    },
  });

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      const roles = (data ?? []).map((r: any) => r.role);
      setIsStaff(roles.includes("super_admin") || roles.includes("moderator"));
    });
  }, [user]);

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingCover(true);
    try {
      const result = await uploadImageWithVariants(file, "user-avatars");
      const url = result.full;
      const { error } = await supabase.from("profiles").update({ cover_url: url } as any).eq("id", user.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Cover photo updated");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not upload cover");
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const shareProfile = async () => {
    const url = handle ? `${window.location.origin}/u/${handle}` : `${window.location.origin}/u/${user?.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: profile?.full_name ?? "PetOS profile", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {}
  };

  return (
    <div className="container-app pad-top-safe pb-24">
      {initialLoading && <ProfileSkeleton />}
      {!initialLoading && (
        <>
          {/* COVER */}
          <div className="relative -mx-4 sm:-mx-6 mb-0">
            <div className="aspect-[16/6] w-full bg-muted relative overflow-hidden">
              {coverUrl ? (
                <img src={coverUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/30 via-coral/20 to-amber/20" />
              )}
              {/* Edit cover */}
              <button
                onClick={() => coverInputRef.current?.click()}
                disabled={uploadingCover}
                className="absolute bottom-3 right-3 h-9 px-3 rounded-full bg-background/90 backdrop-blur border border-hairline text-xs font-medium flex items-center gap-1.5 hover:bg-background"
              >
                <Camera className="h-3.5 w-3.5" />
                {uploadingCover ? "Uploading…" : coverUrl ? "Edit cover" : "Add cover"}
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverChange}
              />
              {/* Top-right settings */}
              <Button
                variant="secondary"
                size="icon"
                onClick={() => nav("/settings")}
                className="absolute top-3 right-3 rounded-full h-9 w-9 bg-background/90 backdrop-blur border border-hairline"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* HEADER ZONE */}
          <div className="px-1 -mt-10 relative">
            <div className="flex items-end justify-between mb-3">
              <div className="h-[88px] w-[88px] rounded-full bg-card ring-4 ring-card overflow-hidden grid place-items-center shadow-lg">
                {profile?.avatar_url ? (
                  <SmartImage src={profile.avatar_url} alt="" aspect="1/1" priority className="w-full h-full" />
                ) : (
                  <div className="w-full h-full bg-primary-soft grid place-items-center font-display text-3xl text-primary">
                    {profile?.full_name?.[0]?.toUpperCase() || "·"}
                  </div>
                )}
              </div>
              {tier?.tier === "plus" && <PlusBadge />}
            </div>

            {/* Name + handle + badge */}
            <div className="mb-1 flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl leading-tight">{profile?.full_name || "Set your name"}</h1>
              <SellerBadge type={accountType as any} verified />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              {handle ? <span>@{handle}</span> : <button onClick={() => nav("/settings/about")} className="text-primary">Set @handle</button>}
              {profile?.city && <><span>·</span><span>{profile.city}</span></>}
            </div>
            {profile?.bio && <p className="text-sm leading-relaxed mb-3 whitespace-pre-line">{profile.bio}</p>}

            {/* Action row */}
            <div className="flex items-center gap-2 mb-4">
              <Button
                onClick={() => nav("/settings/about")}
                className="flex-1 rounded-xl h-10 gap-1.5"
                variant="outline"
              >
                <Edit3 className="h-4 w-4" /> Edit profile
              </Button>
              <Button
                onClick={shareProfile}
                variant="outline"
                className="rounded-xl h-10 px-4 gap-1.5"
              >
                <Share2 className="h-4 w-4" /> Share
              </Button>
            </div>

            {(accountType === "breeder" || accountType === "kennel") && (
              <Button
                onClick={() => nav("/litters/new")}
                className="w-full rounded-xl h-10 gap-1.5 mb-4"
              >
                <Sparkles className="h-4 w-4" /> Record new litter
              </Button>
            )}

            {/* Counts */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              <Counter label="Posts" value={counts?.posts ?? 0} />
              <Counter label="Followers" value={counts?.followers ?? 0} />
              <Counter label="Following" value={counts?.following ?? 0} />
            </div>
          </div>

          {/* BUYER HERO if applicable */}
          {isBuyer && (!pets || pets.length === 0) && (
            <Card className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card card-elev p-5 mb-4">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-2xl bg-primary/15 grid place-items-center shrink-0">
                  <Search className="h-6 w-6 text-primary" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-lg leading-tight">Looking for a pet</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    We'll help you find verified breeders, shelters and rehome listings.
                  </div>
                  {lookingFor && (lookingFor.species?.length || lookingFor.breed || lookingFor.city || lookingFor.max_price_inr) ? (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {lookingFor.species?.map((s) => (
                        <span key={s} className="px-2 h-6 inline-flex items-center rounded-full bg-muted text-[11px] capitalize">{s}</span>
                      ))}
                      {lookingFor.breed && <span className="px-2 h-6 inline-flex items-center rounded-full bg-muted text-[11px]">{lookingFor.breed}</span>}
                      {lookingFor.city && <span className="px-2 h-6 inline-flex items-center rounded-full bg-muted text-[11px]">{lookingFor.city}</span>}
                      {lookingFor.max_price_inr ? <span className="px-2 h-6 inline-flex items-center rounded-full bg-muted text-[11px]">≤ ₹{lookingFor.max_price_inr.toLocaleString()}</span> : null}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <Button onClick={() => nav("/mates?tab=adopt")} className="rounded-2xl h-11">Browse listings</Button>
                <Button variant="outline" onClick={() => nav("/onboarding/buyer-prefs")} className="rounded-2xl h-11">
                  Edit preferences
                </Button>
              </div>
              <button
                onClick={() => nav("/onboarding/account-type")}
                className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground"
              >
                Got a pet now? Switch account type →
              </button>
            </Card>
          )}

          {/* PET RAIL */}
          {!(isBuyer && (!pets || pets.length === 0)) && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">My pets</h2>
                {pets && pets.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-primary h-7 text-xs" onClick={() => nav("/onboarding")}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add pet
                  </Button>
                )}
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 sm:-mx-6 px-4 sm:px-6 pb-1">
                {pets?.map((p: any) => (
                  <PetRailCard key={p.id} pet={p} onClick={() => nav(`/pet/${p.public_id ?? p.id}`)} />
                ))}
                <button
                  onClick={() => nav("/onboarding")}
                  className="shrink-0 w-[88px] flex flex-col items-center gap-1.5 group"
                >
                  <div className="h-[72px] w-[72px] rounded-2xl border-2 border-dashed border-hairline grid place-items-center group-hover:border-primary/50 group-hover:bg-primary/5 transition">
                    <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <span className="text-[11px] text-muted-foreground">Add pet</span>
                </button>
              </div>
            </div>
          )}

          {/* CONTENT TABS */}
          <Tabs defaultValue="posts" className="mt-2">
            <TabsList className="grid w-full grid-cols-3 rounded-xl h-11 p-1 bg-muted/50">
              <TabsTrigger value="posts" className="rounded-lg gap-1.5 data-[state=active]:bg-card">
                <Grid3x3 className="h-4 w-4" /> <span className="hidden sm:inline">Posts</span>
              </TabsTrigger>
              <TabsTrigger value="tagged" className="rounded-lg gap-1.5 data-[state=active]:bg-card">
                <TagIcon className="h-4 w-4" /> <span className="hidden sm:inline">Tagged</span>
              </TabsTrigger>
              <TabsTrigger value="pets" className="rounded-lg gap-1.5 data-[state=active]:bg-card">
                <PawPrint className="h-4 w-4" /> <span className="hidden sm:inline">Pets</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="posts" className="mt-3 -mx-4 sm:-mx-6">
              {user?.id && <PostGrid authorId={user.id} />}
            </TabsContent>

            <TabsContent value="tagged" className="mt-3 -mx-4 sm:-mx-6">
              {user?.id && <PostGrid authorId={user.id} collabsOnly />}
            </TabsContent>

            <TabsContent value="pets" className="mt-3 space-y-3">
              {pets?.length ? pets.map((p: any) => {
                const dob = p.date_of_birth ? new Date(p.date_of_birth) : null;
                const ageYears = dob ? differenceInYears(new Date(), dob) : null;
                const ageMonths = dob ? differenceInMonths(new Date(), dob) % 12 : null;
                const ageStr = dob
                  ? ageYears! >= 1 ? `${ageYears}y ${ageMonths}m` : `${differenceInMonths(new Date(), dob)}m`
                  : null;
                return (
                  <Card key={p.id} className="rounded-3xl border-hairline bg-card card-elev p-0 overflow-hidden">
                    <div className="p-4 flex items-center gap-3">
                      <button
                        onClick={() => nav(`/pet/${p.public_id ?? p.id}`)}
                        className="h-14 w-14 rounded-2xl bg-muted overflow-hidden grid place-items-center shrink-0"
                      >
                        {p.avatar_url
                          ? <SmartImage src={p.avatar_url} alt={p.name} aspect="1/1" className="h-full w-full" />
                          : <span className="font-display text-xl text-primary">{p.name[0]}</span>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => nav(`/pet/${p.public_id ?? p.id}`)} className="font-semibold truncate text-left">
                            {p.name}
                          </button>
                          {p.vaccination_verified && <ShieldCheck className="h-4 w-4 text-sky" strokeWidth={2.4} />}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {[p.breed, p.species, ageStr].filter(Boolean).join(" · ")}
                        </div>
                        {p.bio && <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{p.bio}</div>}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <StatusChip pet={p} />
                          {p.discoverable_for_mating && (
                            <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full bg-coral/12 text-coral text-[10px] font-semibold">
                              <Heart className="h-2.5 w-2.5" fill="currentColor" /> Open to mate
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full h-8 px-3 text-xs"
                        onClick={() => nav(`/settings/pet/${p.id}`)}
                      >
                        Edit
                      </Button>
                    </div>
                    <button
                      onClick={() => setReportingPet(p)}
                      className="w-full text-xs text-emergency font-semibold border-t border-hairline py-2.5 flex items-center justify-center gap-1.5 hover:bg-emergency/5 transition-colors"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" /> Report missing
                    </button>
                  </Card>
                );
              }) : (
                <Card className="rounded-3xl border-hairline bg-card card-elev p-6 text-center">
                  <PawPrint className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-60" />
                  <div className="text-sm text-muted-foreground mb-3">No pets yet</div>
                  {!isBuyer && (
                    <Button onClick={() => nav("/onboarding")} className="rounded-2xl h-11 bg-coral text-coral-foreground hover:bg-coral/90">
                      <Plus className="h-4 w-4 mr-1" /> Add your first pet
                    </Button>
                  )}
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {/* COMPACT MENU */}
          <div className="space-y-1.5 mt-8 mb-6">
            <Row label="My orders" onClick={() => nav("/orders")} />
            <Row label="Manage services" onClick={() => nav("/services/manage")} />
            <Row label="My listings & requests" onClick={() => nav("/mates/manage")} />
            <Row label="My appointments" onClick={() => nav("/appointments")} />
            <Row label="Vet portal" onClick={() => nav("/vet")} />
            {isStaff && <Row label="Admin console" onClick={() => nav("/admin")} />}
          </div>

          <Button variant="outline" onClick={signOut} className="w-full rounded-2xl h-12 border-hairline">
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>

          <div className="mt-8 pt-6 border-t border-hairline">
            <button
              onClick={() => nav("/account/delete")}
              className="text-xs text-muted-foreground hover:text-emergency flex items-center gap-2"
            >
              <AlertTriangle className="h-3 w-3" /> Delete my account
            </button>
          </div>

          <div className="mt-6 mb-10 flex justify-center gap-4 text-xs text-muted-foreground">
            <a href="/legal/terms" className="hover:text-foreground">Terms</a>
            <a href="/legal/privacy" className="hover:text-foreground">Privacy</a>
            <a href="/legal/refunds" className="hover:text-foreground">Refunds</a>
          </div>

          {reportingPet && (
            <MissingCreateSheet
              open={!!reportingPet}
              onOpenChange={(o) => !o && setReportingPet(null)}
              pet={reportingPet}
            />
          )}
        </>
      )}
    </div>
  );
};

const Counter = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-2xl bg-muted/50 py-2.5 text-center">
    <div className="font-display text-xl leading-none tabular-nums">{value}</div>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 font-semibold">{label}</div>
  </div>
);

const Row = ({ label, onClick }: { label: string; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className="w-full rounded-2xl border border-hairline bg-card px-4 h-12 flex items-center justify-between text-sm font-medium hover:bg-muted/30 transition-colors"
  >
    {label}
    <ChevronRight className="h-4 w-4 text-muted-foreground" />
  </button>
);

const StatusChip = ({ pet }: { pet: any }) => {
  if (!pet.status_chip) return null;
  const map: Record<string, { label: string; tone: string }> = {
    available_for_stud: { label: "Available for stud", tone: "bg-coral/12 text-coral" },
    for_sale: { label: "For sale", tone: "bg-amber-500/15 text-amber-700" },
    chilling: { label: "Chilling", tone: "bg-leaf/15 text-leaf" },
  };
  const m = map[pet.status_chip];
  if (!m) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 h-5 rounded-full text-[10px] font-semibold ${m.tone}`}>
      {m.label}
    </span>
  );
};

const PetRailCard = ({ pet, onClick }: { pet: any; onClick: () => void }) => {
  const dob = pet.date_of_birth ? new Date(pet.date_of_birth) : null;
  const ageYears = dob ? differenceInYears(new Date(), dob) : null;
  const ageStr = dob ? (ageYears! >= 1 ? `${ageYears}y` : `${differenceInMonths(new Date(), dob)}m`) : null;
  const speciesEmoji: Record<string, string> = { dog: "🐕", cat: "🐱", bird: "🐦", rabbit: "🐰" };
  return (
    <button onClick={onClick} className="shrink-0 w-[88px] flex flex-col items-center gap-1.5">
      <div className="h-[72px] w-[72px] rounded-2xl bg-muted overflow-hidden grid place-items-center ring-2 ring-transparent hover:ring-primary/30 transition">
        {pet.avatar_url
          ? <SmartImage src={pet.avatar_url} alt={pet.name} aspect="1/1" className="w-full h-full" />
          : <span className="font-display text-2xl text-primary">{pet.name[0]}</span>}
      </div>
      <div className="text-center w-full">
        <div className="text-xs font-medium truncate">{pet.name}</div>
        <div className="text-[10px] text-muted-foreground">
          {speciesEmoji[pet.species] ?? "🐾"} {ageStr ?? ""}
        </div>
      </div>
    </button>
  );
};

export default Profile;
