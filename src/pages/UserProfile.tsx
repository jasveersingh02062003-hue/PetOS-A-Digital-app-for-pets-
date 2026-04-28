import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFollowCounts } from "@/hooks/useFollows";
import { FollowButton } from "@/components/social/FollowButton";
import { MessageButton } from "@/components/social/MessageButton";
import { PostGrid } from "@/components/social/PostGrid";
import { AchievementChips } from "@/components/social/AchievementChips";
import { SellerBadge } from "@/components/SellerBadge";
import { useIsVerifiedOrg } from "@/hooks/useVerifiedOrgs";
import { SmartImage } from "@/components/SmartImage";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Settings, Building2, ShieldCheck, ArrowRight, Share2,
  Grid3x3, Tag as TagIcon, PawPrint, Heart, Award,
} from "lucide-react";
import { differenceInYears, differenceInMonths } from "date-fns";
import { toast } from "sonner";

const UserProfile = () => {
  const { userId: param } = useParams<{ userId: string }>();
  const nav = useNavigate();
  const { user } = useAuth();

  // Allow @handle or uuid in the URL
  const isUuid = !!param && /^[0-9a-f-]{36}$/i.test(param);

  const { data: handleResolved } = useQuery({
    queryKey: ["handle->id", param],
    enabled: !!param && !isUuid,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .ilike("handle", param!)
        .maybeSingle();
      return (data as any)?.id ?? null;
    },
  });

  const userId: string | null = isUuid ? (param as string) : (handleResolved ?? null);
  const isMe = !!user?.id && user.id === userId;

  // Try to read full profile (works only if it's me; falls back to public RPC)
  const { data: profile } = useQuery({
    queryKey: ["profile-public", userId],
    enabled: !!userId,
    queryFn: async () => {
      // For own profile we have full access
      if (user?.id === userId) {
        const { data } = await supabase.from("profiles").select("*").eq("id", userId!).maybeSingle();
        return data;
      }
      // For others: public RPC
      const { data } = await supabase.rpc("get_profiles_public");
      return (data ?? []).find((p: any) => p.id === userId) ?? null;
    },
  });

  const { data: pets } = useQuery({
    queryKey: ["pets-public", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_pets_public");
      return (data ?? []).filter((p: any) => p.owner_id === userId);
    },
  });

  const { data: counts } = useFollowCounts(userId ?? undefined);

  const { data: org } = useQuery({
    queryKey: ["org-public", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("org_profiles")
        .select("user_id, org_name, org_type, status, city")
        .eq("user_id", userId!)
        .maybeSingle();
      if (!data) return null;
      if (data.status === "approved") return data;
      return null;
    },
  });

  const { data: postCount } = useQuery({
    queryKey: ["post-count", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count } = await supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("author_id", userId!);
      return count ?? 0;
    },
  });

  if (param && !isUuid && handleResolved === null) {
    return (
      <div className="container-app pt-8 text-center">
        <div className="font-display text-xl mb-2">User not found</div>
        <Button onClick={() => nav("/")} variant="outline">Go home</Button>
      </div>
    );
  }

  const accountType = (profile as any)?.account_type ?? "pet_parent";
  const handle = (profile as any)?.handle as string | null | undefined;
  const coverUrl = (profile as any)?.cover_url as string | null | undefined;
  const isVerifiedOrg = useIsVerifiedOrg(userId);
  const lookingFor = (profile as any)?.looking_for as
    | { species?: string[] | null; breed?: string | null; city?: string | null; max_price_inr?: number | null }
    | null
    | undefined;

  const shareProfile = async () => {
    const url = handle ? `${window.location.origin}/u/${handle}` : `${window.location.origin}/u/${userId}`;
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
      <header className="pt-3 pb-2 flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-base flex-1 truncate">
          {handle ? `@${handle}` : profile?.full_name ?? "Profile"}
        </h1>
        {isMe ? (
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => nav("/settings")}>
            <Settings className="h-5 w-5" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="rounded-full" onClick={shareProfile}>
            <Share2 className="h-5 w-5" />
          </Button>
        )}
      </header>

      {/* COVER */}
      <div className="-mx-4 sm:-mx-6 mb-0">
        <div className="aspect-[16/6] w-full bg-muted relative overflow-hidden">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 via-coral/20 to-amber/20" />
          )}
        </div>
      </div>

      {/* Header */}
      <div className="px-1 -mt-10">
        <div className="h-[88px] w-[88px] rounded-full bg-card ring-4 ring-card overflow-hidden grid place-items-center shadow-lg mb-3">
          {profile?.avatar_url ? (
            <SmartImage src={profile.avatar_url} alt="" aspect="1/1" priority className="w-full h-full" />
          ) : (
            <div className="w-full h-full bg-primary-soft grid place-items-center font-display text-3xl text-primary">
              {profile?.full_name?.[0]?.toUpperCase() || "·"}
            </div>
          )}
        </div>

        <div className="mb-1 flex items-center gap-2 flex-wrap">
          <h2 className="font-display text-2xl leading-tight">{profile?.full_name ?? "—"}</h2>
          <SellerBadge type={accountType as any} verified={isVerifiedOrg} />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          {handle && <span>@{handle}</span>}
          {handle && profile?.city && <span>·</span>}
          {profile?.city && <span>{profile.city}</span>}
        </div>
        {profile?.bio && <p className="text-sm leading-relaxed mb-3 whitespace-pre-line">{profile.bio}</p>}

        {!isMe && userId && (
          <div className="flex items-center gap-2 mb-4">
            <FollowButton targetId={userId} size="default" />
            <MessageButton userId={userId} size="default" variant="outline" />
            <Button onClick={shareProfile} variant="outline" size="icon" className="rounded-xl h-10 w-10 shrink-0">
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Counts */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <Counter label="Posts" value={postCount ?? 0} />
          <Counter label="Followers" value={counts?.followers ?? 0} />
          <Counter label="Following" value={counts?.following ?? 0} />
        </div>
      </div>

      {/* Org callout */}
      {org && userId && (
        <Card
          onClick={() => nav(`/org/${userId}`)}
          className="rounded-2xl border-hairline shadow-none p-4 mb-4 cursor-pointer hover:bg-muted/40 transition"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium truncate">{org.org_name}</span>
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
              </div>
              <div className="text-xs text-muted-foreground capitalize">
                {org.org_type} {org.city ? `· ${org.city}` : ""}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </Card>
      )}

      {/* PET RAIL */}
      {pets && pets.length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Pets</h2>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 sm:-mx-6 px-4 sm:px-6 pb-1">
            {pets.map((p: any) => (
              <PetRailCard key={p.id} pet={p} onClick={() => nav(`/pet/${p.public_id ?? p.id}`)} />
            ))}
          </div>
        </div>
      )}

      {/* TABS */}
      <Tabs defaultValue="posts" className="mt-2">
        <TabsList className="grid w-full grid-cols-4 rounded-xl h-11 p-1 bg-muted/50">
          <TabsTrigger value="posts" className="rounded-lg gap-1 data-[state=active]:bg-card text-xs">
            <Grid3x3 className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="tagged" className="rounded-lg gap-1 data-[state=active]:bg-card text-xs">
            <TagIcon className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="pets" className="rounded-lg gap-1 data-[state=active]:bg-card text-xs">
            <PawPrint className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="badges" className="rounded-lg gap-1 data-[state=active]:bg-card text-xs">
            <Award className="h-4 w-4" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-3 -mx-4 sm:-mx-6">
          {userId && <PostGrid authorId={userId} />}
        </TabsContent>
        <TabsContent value="tagged" className="mt-3 -mx-4 sm:-mx-6">
          {userId && <PostGrid authorId={userId} collabsOnly />}
        </TabsContent>
        <TabsContent value="pets" className="mt-3 space-y-2">
          {pets?.length ? pets.map((p: any) => (
            <Card key={p.id} onClick={() => nav(`/pet/${p.public_id ?? p.id}`)} className="rounded-2xl border-hairline shadow-none p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/40">
              <div className="h-12 w-12 rounded-2xl bg-muted overflow-hidden flex items-center justify-center">
                {p.avatar_url ? <SmartImage src={p.avatar_url} alt={p.name} aspect="1/1" className="w-full h-full" /> : <span className="font-display">{p.name[0]}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground truncate">{[p.breed, p.species].filter(Boolean).join(" · ")}</div>
                {p.bio && <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{p.bio}</div>}
              </div>
              <div className="flex flex-col items-end gap-1">
                {p.vaccination_verified && <ShieldCheck className="h-4 w-4 text-sky" />}
                <StatusChip pet={p} />
              </div>
            </Card>
          )) : <div className="text-center text-sm text-muted-foreground py-6">No pets yet</div>}
        </TabsContent>
        <TabsContent value="badges" className="mt-3">
          {userId && <AchievementChips userId={userId} />}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const Counter = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-2xl bg-muted/50 py-2.5 text-center">
    <div className="font-display text-xl leading-none tabular-nums">{value}</div>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 font-semibold">{label}</div>
  </div>
);

const StatusChip = ({ pet }: { pet: any }) => {
  if (!pet.status_chip) return null;
  const map: Record<string, { label: string; tone: string }> = {
    available_for_stud: { label: "Stud", tone: "bg-coral/12 text-coral" },
    for_sale: { label: "For sale", tone: "bg-amber-500/15 text-amber-700" },
    chilling: { label: "Chilling", tone: "bg-leaf/15 text-leaf" },
  };
  const m = map[pet.status_chip];
  if (!m) return null;
  return (
    <span className={`inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold ${m.tone}`}>
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

export default UserProfile;
