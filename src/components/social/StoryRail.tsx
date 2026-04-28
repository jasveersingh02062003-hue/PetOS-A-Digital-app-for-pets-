import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useActiveStories } from "@/hooks/useStories";
import { StoryComposer } from "./StoryComposer";
import { StoryViewer } from "./StoryViewer";
import { SmartImage } from "@/components/SmartImage";
import { StoryRailSkeleton } from "@/components/skeletons/FeedSkeleton";
import { Plus } from "lucide-react";

export const StoryRail = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: groups, isLoading } = useActiveStories();
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);

  if (isLoading && !groups) return <StoryRailSkeleton />;

  const myGroupIdx = groups?.findIndex((g) => g.author_id === user?.id) ?? -1;
  const others = (groups ?? []).filter((g) => g.author_id !== user?.id);

  return (
    <>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 py-3">
        {/* Your story */}
        <button
          onClick={() => myGroupIdx >= 0 ? setViewerIdx(myGroupIdx) : setComposerOpen(true)}
          className="flex flex-col items-center gap-1.5 shrink-0"
        >
          <div className="relative h-16 w-16 rounded-full bg-muted overflow-hidden flex items-center justify-center ring-2 ring-offset-2 ring-offset-background ring-primary/30">
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
          </div>
          <span className="text-[11px] text-muted-foreground">{myGroupIdx >= 0 ? "Your story" : "Add story"}</span>
        </button>

        {/* Others */}
        {others.map((g) => {
          const realIdx = groups!.findIndex((x) => x.author_id === g.author_id);
          const cover = g.stories[0];
          return (
            <button
              key={g.author_id}
              onClick={() => setViewerIdx(realIdx)}
              className="flex flex-col items-center gap-1.5 shrink-0"
            >
              <div className="h-16 w-16 rounded-full overflow-hidden ring-2 ring-offset-2 ring-offset-background ring-primary">
                <SmartImage src={cover.image_url} alt="" className="w-full h-full" aspect="1/1" />
              </div>
              <span className="text-[11px] text-muted-foreground max-w-[64px] truncate">{g.author_name?.split(" ")[0] ?? "Pet"}</span>
            </button>
          );
        })}
      </div>

      <StoryComposer open={composerOpen} onOpenChange={setComposerOpen} />
      <StoryViewer groups={groups ?? []} startGroupIdx={viewerIdx} onClose={() => setViewerIdx(null)} />
    </>
  );
};
