import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, usePets } from "@/hooks/useProfile";
import { useTier } from "@/hooks/useTier";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LogOut, Settings, Plus, Sparkles, AlertTriangle, Heart, ShieldCheck, ChevronRight,
} from "lucide-react";
import { PlusBadge } from "@/components/PlusBadge";
import { MissingCreateSheet } from "@/components/MissingCreateSheet";
import { SmartImage } from "@/components/SmartImage";
import { ProfileSkeleton, GridSkeleton } from "@/components/skeletons/FeedSkeleton";
import { differenceInMonths, differenceInYears } from "date-fns";

const Profile = () => {
  const nav = useNavigate();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { data: pets } = usePets();
  const { data: tier } = useTier();
  const [isStaff, setIsStaff] = useState(false);
  const [reportingPet, setReportingPet] = useState<any | null>(null);

  const initialLoading = !profile && !pets;

  // Counters: posts / followers / following
  const { data: counts } = useQuery({
    queryKey: ["profile-counts", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const [posts, followers, following] = await Promise.all([
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", user!.id),
        supabase.from("follows" as any).select("id", { count: "exact", head: true }).eq("followee_id", user!.id),
        supabase.from("follows" as any).select("id", { count: "exact", head: true }).eq("follower_id", user!.id),
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

  return (
    <div className="container-app pad-top-safe">
      <header className="pt-6 pb-4 flex items-center justify-between">
        <h1 className="font-display text-[28px] leading-tight">Profile</h1>
        <Button variant="ghost" size="icon" className="rounded-full h-10 w-10" onClick={() => nav("/settings")}>
          <Settings className="h-5 w-5" strokeWidth={1.8} />
        </Button>
      </header>

      {initialLoading && <ProfileSkeleton />}
      {!initialLoading && (
      <>
      {/* COVER + AVATAR */}
      <div className="relative rounded-3xl overflow-hidden card-elev mb-4 bg-card border border-hairline">
        <div className="h-24 bg-gradient-to-br from-primary/30 via-coral/20 to-amber/20" />
        <div className="px-4 pb-4 -mt-9">
          <div className="flex items-end justify-between">
            <div className="h-[72px] w-[72px] rounded-full bg-card ring-4 ring-card overflow-hidden grid place-items-center">
              {(profile as any)?.avatar_url ? (
                <SmartImage src={(profile as any).avatar_url} alt="" aspect="1/1" priority className="w-full h-full" />
              ) : (
                <div className="w-full h-full bg-primary-soft grid place-items-center font-display text-2xl text-primary">
                  {profile?.full_name?.[0]?.toUpperCase() || "·"}
                </div>
              )}
            </div>
            {tier?.tier === "plus" && <PlusBadge />}
          </div>
          <div className="mt-3">
            <div className="font-display text-xl leading-tight">{profile?.full_name || "Set your name"}</div>
            <div className="text-xs text-muted-foreground">{profile?.city || "Set your city"}</div>
          </div>

          {/* Counters */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <Counter label="Posts" value={counts?.posts ?? 0} />
            <Counter label="Followers" value={counts?.followers ?? 0} />
            <Counter label="Following" value={counts?.following ?? 0} />
          </div>
        </div>
      </div>

      {/* Plus upsell */}
      {tier?.tier !== "plus" && (
        <button
          onClick={() => nav("/plus")}
          className="w-full text-left rounded-3xl card-elev p-4 mb-4 bg-gradient-to-br from-lilac/15 via-card to-amber/10 border border-lilac/20 flex items-center gap-3"
        >
          <div className="h-10 w-10 rounded-2xl bg-lilac/20 grid place-items-center shrink-0">
            <Sparkles className="h-5 w-5 text-lilac" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">Try Petos Plus</div>
            <div className="text-xs text-muted-foreground">Unlimited AI · 2 vet consults / mo · more</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* MY PETS — richer cards */}
      <div className="flex items-center justify-between mt-2 mb-3">
        <h2 className="font-display text-lg">My pets</h2>
        <Button variant="ghost" size="sm" className="text-primary" onClick={() => nav("/onboarding")}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      <div className="space-y-3 mb-8">
        {pets?.map((p: any) => {
          const dob = p.date_of_birth ? new Date(p.date_of_birth) : null;
          const ageYears = dob ? differenceInYears(new Date(), dob) : null;
          const ageMonths = dob ? differenceInMonths(new Date(), dob) % 12 : null;
          const ageStr = dob
            ? ageYears! >= 1 ? `${ageYears}y ${ageMonths}m` : `${differenceInMonths(new Date(), dob)}m`
            : null;
          return (
            <Card key={p.id} className="rounded-3xl border-hairline bg-card card-elev p-0 overflow-hidden">
              <div className="p-4 flex items-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-muted overflow-hidden grid place-items-center shrink-0">
                  {p.avatar_url
                    ? <SmartImage src={p.avatar_url} alt={p.name} aspect="1/1" className="h-full w-full" />
                    : <span className="font-display text-xl text-primary">{p.name[0]}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="font-semibold truncate">{p.name}</div>
                    {p.vaccination_verified && <ShieldCheck className="h-4 w-4 text-sky" strokeWidth={2.4} />}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[p.breed, p.species, ageStr].filter(Boolean).join(" · ")}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
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
        })}
        {(!pets || pets.length === 0) && (
          <Card className="rounded-3xl border-hairline bg-card card-elev p-6 text-center">
            <div className="text-sm text-muted-foreground mb-3">No pets yet</div>
            <Button onClick={() => nav("/onboarding")} className="rounded-2xl h-11 bg-coral text-coral-foreground hover:bg-coral/90">
              <Plus className="h-4 w-4 mr-1" /> Add your first pet
            </Button>
          </Card>
        )}
      </div>

      {/* COMPACT MENU */}
      <div className="space-y-1.5 mb-6">
        <Row label="My orders" onClick={() => nav("/orders")} />
        <Row label="Manage services" onClick={() => nav("/services/manage")} />
        <Row label="My listings & requests" onClick={() => nav("/mates/manage")} />
        <Row label="My appointments" onClick={() => nav("/appointments")} />
        <Row label="Vet portal" onClick={() => nav("/vet")} />
        <Row label="Saved posts" onClick={() => nav("/profile")} />
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
    <div className="font-display text-xl leading-none">{value}</div>
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

export default Profile;
