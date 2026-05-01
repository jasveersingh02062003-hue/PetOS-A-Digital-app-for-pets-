import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useActiveStories } from "@/hooks/useStories";
import { StoryComposer } from "./StoryComposer";
import { StoryViewer } from "./StoryViewer";
import { SmartImage } from "@/components/SmartImage";
import { StoryRailSkeleton } from "@/components/skeletons/FeedSkeleton";
import { getRoleRing } from "@/lib/roleTheme";
import { usePublicProfiles } from "@/hooks/usePublicProfiles";
import { useOrgIdentities } from "@/hooks/useOrgIdentities";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { SmartStoryPrompt } from "./SmartStoryPrompt";

const ORG_ROLES = new Set(["breeder", "kennel", "shelter", "sanctuary", "zoo"]);

export const StoryRail = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: groups, isLoading } = useActiveStories();
  const { data: profilesPublic } = usePublicProfiles();
  const { data: orgs } = useOrgIdentities();
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);

  if (isLoading && !groups) return <StoryRailSkeleton />;

  const myGroupIdx = groups?.findIndex((g) => g.author_id === user?.id) ?? -1;
  const others = (groups ?? []).filter((g) => g.author_id !== user?.id);
  const myRing = getRoleRing((profile?.account_type as any) ?? "pet_parent");

  // No stories anywhere — replace the lonely "Add story" with a personal prompt
  // so the rail never feels dead. Far more inviting than a single "+" tile.
  if (others.length === 0 && myGroupIdx < 0) {
    return (
      <>
        <SmartStoryPrompt />
        <StoryComposer open={composerOpen} onOpenChange={setComposerOpen} />
      </>
    );
  }

  // Fresh-story pulse: my latest story posted in the last 60min
  const myFreshest = myGroupIdx >= 0 ? groups![myGroupIdx].stories.slice(-1)[0] : null;
  const isLive =
    !!myFreshest && Date.now() - new Date(myFreshest.created_at).getTime() < 60 * 60 * 1000;

  return (
    <>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 py-3 animate-fade-in">
        {/* Your story / Add */}
        <button
          onClick={() => myGroupIdx >= 0 ? setViewerIdx(myGroupIdx) : setComposerOpen(true)}
          className="flex flex-col items-center gap-1.5 shrink-0 group"
          aria-label={myGroupIdx >= 0 ? "Your story" : "Add story"}
        >
          <div
            className={cn(
              "relative h-16 w-16 rounded-full bg-muted overflow-hidden flex items-center justify-center",
              "ring-2 ring-offset-2 ring-offset-background transition-transform group-active:scale-95",
              myRing,
            )}
          >
            {profile?.avatar_url ? (
              <SmartImage src={profile.avatar_url} alt="You" className="w-full h-full" aspect="1/1" />
            ) : (
              <span className="font-display text-xl text-ink-soft">{profile?.full_name?.[0] ?? "·"}</span>
            )}
            {myGroupIdx < 0 && (
              <div className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full bg-primary flex items-center justify-center ring-2 ring-background">
                <Plus className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={2.5} />
              </div>
            )}
            {isLive && (
              <span
                className="absolute top-0 right-0 h-3 w-3 rounded-full bg-coral ring-2 ring-background animate-pulse"
                title="Just posted"
              />
            )}
          </div>
          <span className="text-[11px] text-muted-foreground">
            {myGroupIdx >= 0 ? "Your story" : "Add"}
          </span>
        </button>

        {/* Others */}
        {others.map((g) => {
          const realIdx = groups!.findIndex((x) => x.author_id === g.author_id);
          const cover = g.stories[0];
          const authorProfile = profilesPublic?.find((p) => p.id === g.author_id);
          const accountType = (authorProfile?.account_type ?? "pet_parent") as string;
          const ringClass = getRoleRing(accountType as any);
          const org = orgs?.get(g.author_id);
          const isOrg = ORG_ROLES.has(accountType) && !!org?.org_name;
          const labelRaw = isOrg ? (org!.org_name as string) : (g.author_name ?? authorProfile?.full_name ?? "Pet");
          const label = labelRaw.split(" ")[0];
          return (
            <button
              key={g.author_id}
              onClick={() => setViewerIdx(realIdx)}
              className="flex flex-col items-center gap-1.5 shrink-0 group"
            >
              <div
                className={cn(
                  "h-16 w-16 rounded-full overflow-hidden ring-2 ring-offset-2 ring-offset-background",
                  "transition-transform group-active:scale-95",
                  ringClass,
                )}
              >
                <SmartImage src={cover.image_url} alt="" className="w-full h-full" aspect="1/1" />
              </div>
              <span className="text-[11px] text-muted-foreground max-w-[64px] truncate">{label}</span>
            </button>
          );
        })}
      </div>

      <StoryComposer open={composerOpen} onOpenChange={setComposerOpen} />
      <StoryViewer groups={groups ?? []} startGroupIdx={viewerIdx} onClose={() => setViewerIdx(null)} />
    </>
  );
};

