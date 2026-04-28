import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { markStoryViewed, type StoryGroup } from "@/hooks/useStories";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { SmartImage } from "@/components/SmartImage";
import { X } from "lucide-react";

const STORY_DURATION_MS = 5000;

export const StoryViewer = ({
  groups,
  startGroupIdx,
  onClose,
}: {
  groups: StoryGroup[];
  startGroupIdx: number | null;
  onClose: () => void;
}) => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [groupIdx, setGroupIdx] = useState<number | null>(startGroupIdx);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => { setGroupIdx(startGroupIdx); setStoryIdx(0); setProgress(0); }, [startGroupIdx]);

  const group = groupIdx != null ? groups[groupIdx] : null;
  const story = group?.stories[storyIdx];

  useEffect(() => {
    if (!story || !user) return;
    markStoryViewed(story.id, user.id);
  }, [story?.id, user?.id]);

  useEffect(() => {
    if (!story) return;
    setProgress(0);
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min((Date.now() - start) / STORY_DURATION_MS, 1);
      setProgress(p);
      if (p >= 1) {
        clearInterval(id);
        advance();
      }
    }, 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  const advance = () => {
    if (!group || groupIdx == null) return;
    if (storyIdx < group.stories.length - 1) {
      setStoryIdx(storyIdx + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx(groupIdx + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  };

  const back = () => {
    if (storyIdx > 0) setStoryIdx(storyIdx - 1);
    else if (groupIdx != null && groupIdx > 0) {
      const prev = groupIdx - 1;
      setGroupIdx(prev);
      setStoryIdx(groups[prev].stories.length - 1);
    }
  };

  if (!story || !group) return null;

  return (
    <Dialog open={groupIdx != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 max-w-md h-[100dvh] sm:h-[90vh] rounded-none sm:rounded-2xl overflow-hidden bg-black border-0">
        <div className="relative h-full w-full flex flex-col">
          {/* progress bars */}
          <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 p-2">
            {group.stories.map((_, i) => (
              <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-[width] duration-50"
                  style={{ width: i < storyIdx ? "100%" : i === storyIdx ? `${progress * 100}%` : "0%" }}
                />
              </div>
            ))}
          </div>

          {/* header */}
          <div className="absolute top-4 left-0 right-0 z-10 flex items-center gap-3 px-4 pt-4">
            <button
              onClick={() => { onClose(); nav(`/u/${group.author_id}`); }}
              className="flex items-center gap-2 min-w-0"
            >
              <Avatar className="h-8 w-8 ring-2 ring-white/40">
                <AvatarImage src={group.author_avatar ?? undefined} />
                <AvatarFallback className="text-xs bg-white/20 text-white">{group.author_name?.[0] ?? "·"}</AvatarFallback>
              </Avatar>
              <div className="text-left min-w-0">
                <div className="text-white text-sm font-medium truncate">{group.author_name ?? "Pet parent"}</div>
                <div className="text-white/60 text-[11px]">{formatDistanceToNow(new Date(story.created_at), { addSuffix: true })}</div>
              </div>
            </button>
            <button onClick={onClose} className="ml-auto h-9 w-9 rounded-full flex items-center justify-center text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* image + tap zones */}
          <div className="relative flex-1 flex items-center justify-center">
            <SmartImage
              src={story.image_url}
              alt=""
              variant="full"
              priority
              className="max-h-full max-w-full"
            />
            <button onClick={back} className="absolute top-0 left-0 bottom-0 w-1/3" aria-label="Previous" />
            <button onClick={advance} className="absolute top-0 right-0 bottom-0 w-2/3" aria-label="Next" />
          </div>

          {story.caption && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
              <p className="text-white text-sm">{story.caption}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
