import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFollowCounts } from "@/hooks/useFollows";
import { FollowButton } from "@/components/social/FollowButton";
import { PostGrid } from "@/components/social/PostGrid";
import { AchievementChips } from "@/components/social/AchievementChips";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { ArrowLeft, MapPin, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const isMe = user?.id === userId;

  const { data: profile } = useQuery({
    queryKey: ["profile-public", userId],
    enabled: !!userId,
    queryFn: async () => {
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

  const { data: counts } = useFollowCounts(userId);

  const { data: postCount } = useQuery({
    queryKey: ["post-count", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count } = await supabase.from("posts").select("*", { count: "exact", head: true }).eq("author_id", userId!);
      return count ?? 0;
    },
  });

  return (
    <div className="container-app pad-top-safe pb-20">
      <header className="pt-4 pb-2 flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-lg flex-1 truncate">{profile?.full_name ?? "Profile"}</h1>
        {isMe && (
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => nav("/settings")}>
            <Settings className="h-5 w-5" />
          </Button>
        )}
      </header>

      <div className="flex items-center gap-4 mb-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={profile?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-primary-soft text-primary font-display text-2xl">{profile?.full_name?.[0] ?? "·"}</AvatarFallback>
        </Avatar>
        <div className="flex-1 grid grid-cols-3 text-center">
          <Stat label="Posts" value={postCount ?? 0} />
          <Stat label="Followers" value={counts?.followers ?? 0} />
          <Stat label="Following" value={counts?.following ?? 0} />
        </div>
      </div>

      <div className="mb-4">
        <div className="font-display text-xl">{profile?.full_name ?? "—"}</div>
        {profile?.city && <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3.5 w-3.5" /> {profile.city}</div>}
        {profile?.bio && <p className="text-sm mt-2 leading-relaxed">{profile.bio}</p>}
      </div>

      {!isMe && userId && (
        <div className="mb-4">
          <FollowButton targetId={userId} size="default" />
        </div>
      )}

      {pets && pets.length > 0 && (
        <div className="mb-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Pets</div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5">
            {pets.map((p: any) => (
              <button key={p.id} onClick={() => nav(`/pet/${p.id}`)} className="flex flex-col items-center gap-1.5 shrink-0 w-16">
                <div className="h-14 w-14 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                  {p.avatar_url ? <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" /> : <span className="font-display text-lg">{p.name[0]}</span>}
                </div>
                <span className="text-[11px] text-center truncate w-full">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Tabs defaultValue="posts" className="mt-2">
        <TabsList className="grid w-full grid-cols-3 rounded-xl">
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="pets">Pets</TabsTrigger>
          <TabsTrigger value="badges">Badges</TabsTrigger>
        </TabsList>
        <TabsContent value="posts" className="mt-3">
          {userId && <PostGrid authorId={userId} />}
        </TabsContent>
        <TabsContent value="pets" className="mt-3 space-y-2">
          {pets?.length ? pets.map((p: any) => (
            <Card key={p.id} onClick={() => nav(`/pet/${p.id}`)} className="rounded-2xl border-hairline shadow-none p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/40">
              <div className="h-12 w-12 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                {p.avatar_url ? <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" /> : <span className="font-display">{p.name[0]}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.breed ?? p.species}</div>
              </div>
              {p.vaccination_verified && <span className="text-[10px] bg-primary-soft text-primary px-2 py-0.5 rounded-full">Verified</span>}
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

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div>
    <div className="font-display text-lg tabular-nums">{value}</div>
    <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</div>
  </div>
);

export default UserProfile;
