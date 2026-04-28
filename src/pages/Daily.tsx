import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTodaysPrompt, useTodaysMoments, useStreakLeaderboard, useLinkMoment } from "@/hooks/useDailyPrompt";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StreakChip } from "@/components/social/StreakChip";
import { Sparkles, Camera, Lock, Flame, ChevronLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ComposerForDailyMoment } from "@/components/social/DailyMomentComposer";

export default function Daily() {
  const navigate = useNavigate();
  const { data, isLoading } = useTodaysPrompt();
  const { data: moments } = useTodaysMoments(data?.prompt?.id, !!data?.myMoment);
  const { data: board } = useStreakLeaderboard();
  const [composerOpen, setComposerOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background grid place-items-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!data?.prompt) {
    return (
      <div className="min-h-screen bg-background">
        <Header onBack={() => navigate(-1)} />
        <div className="px-6 py-20 text-center">
          <Sparkles className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <h2 className="font-display text-xl mb-1">No prompt yet today</h2>
          <p className="text-sm text-muted-foreground">
            We drop a fresh Pet Moment at a random time each day. Keep notifications on.
          </p>
        </div>
      </div>
    );
  }

  const dropped = new Date(data.prompt.dropped_at).getTime();
  const closes = dropped + data.prompt.window_minutes * 60_000;
  const remainingMin = Math.max(0, Math.round((closes - Date.now()) / 60_000));
  const onTime = remainingMin > 0;

  return (
    <div className="min-h-screen bg-background pb-12">
      <Header onBack={() => navigate(-1)} />

      <div className="px-4 pt-3">
        <div className="rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-background border border-primary/30 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              Today's Pet Moment
            </span>
            {data.streak && <StreakChip streak={data.streak.current_streak} className="ml-auto" />}
          </div>
          <h1 className="font-display text-2xl leading-tight mb-3">{data.prompt.prompt_text}</h1>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
            <span>
              {onTime ? `Closes in ${remainingMin} min` : "Window closed — late posts won't count"}
            </span>
            {data.myMoment && (
              <span className="font-semibold text-primary">
                ✓ Posted {data.myMoment.on_time ? "on time" : `${data.myMoment.late_minutes}m late`}
              </span>
            )}
          </div>
          {!data.myMoment && (
            <Button onClick={() => setComposerOpen(true)} size="lg" className="w-full rounded-xl gap-2">
              <Camera className="h-4 w-4" /> Capture your moment
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="feed" className="mt-5">
        <TabsList className="mx-4 grid grid-cols-2 rounded-xl">
          <TabsTrigger value="feed">Today's moments</TabsTrigger>
          <TabsTrigger value="streaks">Top streaks</TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="mt-3">
          {!data.myMoment ? (
            <div className="mx-4 rounded-2xl border border-hairline bg-muted/40 px-6 py-12 text-center">
              <Lock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Post your moment to unlock</p>
              <p className="text-xs text-muted-foreground mt-1">
                See what everyone's pet is up to right now.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1 px-1">
              {(moments ?? []).map((m: any) => (
                <div key={m.id} className="aspect-square bg-muted relative overflow-hidden rounded-md">
                  {m.posts?.image_url ? (
                    <img src={m.posts.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-xs text-muted-foreground p-2">
                      {m.posts?.caption?.slice(0, 80) ?? "—"}
                    </div>
                  )}
                  {m.on_time && (
                    <div className="absolute top-1.5 left-1.5 bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                      ON TIME
                    </div>
                  )}
                </div>
              ))}
              {moments?.length === 0 && (
                <div className="col-span-2 text-center text-sm text-muted-foreground py-12">
                  Be the first to post today!
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="streaks" className="mt-3 px-4 space-y-2">
          {(board ?? []).map((s: any, i: number) => (
            <div key={s.user_id} className="flex items-center gap-3 rounded-xl border border-hairline px-3 py-2">
              <span className="font-display text-lg w-6 text-center text-muted-foreground">
                {i + 1}
              </span>
              <Avatar className="h-9 w-9">
                <AvatarImage src={s.profile?.avatar_url ?? undefined} />
                <AvatarFallback>{s.profile?.full_name?.[0] ?? "?"}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{s.profile?.full_name ?? "User"}</div>
                <div className="text-xs text-muted-foreground">Best: {s.longest_streak}</div>
              </div>
              <div className="flex items-center gap-1 text-orange-500 font-semibold">
                <Flame className="h-4 w-4 fill-current" />
                {s.current_streak}
              </div>
            </div>
          ))}
          {board?.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-12">
              No streaks yet — start one today.
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Capture your moment</DialogTitle>
          </DialogHeader>
          <ComposerForDailyMoment
            promptId={data.prompt.id}
            promptText={data.prompt.prompt_text}
            onDone={() => setComposerOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Header = ({ onBack }: { onBack: () => void }) => (
  <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-hairline px-3 py-2.5 flex items-center gap-2">
    <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full h-9 w-9">
      <ChevronLeft className="h-5 w-5" />
    </Button>
    <h1 className="font-display text-lg">Daily Moment</h1>
  </div>
);
