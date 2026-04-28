import { Card } from "@/components/ui/card";

const Block = ({ className = "" }: { className?: string }) => (
  <div className={`rounded-xl bg-muted animate-pulse ${className}`} />
);

export const FeedSkeleton = ({ count = 3 }: { count?: number }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i} className="rounded-2xl border-hairline bg-card shadow-none overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <Block className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Block className="h-3 w-1/3" />
            <Block className="h-2.5 w-1/4" />
          </div>
          <Block className="h-7 w-16 rounded-full" />
        </div>
        <Block className="aspect-square rounded-none" />
        <div className="p-4 space-y-2">
          <Block className="h-3 w-3/4" />
          <Block className="h-3 w-1/2" />
        </div>
      </Card>
    ))}
  </div>
);

export const StoryRailSkeleton = () => (
  <div className="flex gap-3 overflow-hidden -mx-5 px-5 py-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
        <div className="h-16 w-16 rounded-full bg-muted animate-pulse" />
        <div className="h-2 w-10 rounded bg-muted animate-pulse" />
      </div>
    ))}
  </div>
);

export const ProfileSkeleton = () => (
  <div className="space-y-4">
    <div className="h-32 rounded-2xl bg-muted animate-pulse" />
    <div className="flex items-center gap-4 -mt-10 px-4">
      <div className="h-20 w-20 rounded-full bg-muted animate-pulse ring-4 ring-background" />
      <div className="flex-1 space-y-2 pt-8">
        <Block className="h-4 w-1/3" />
        <Block className="h-3 w-1/4" />
      </div>
    </div>
    <div className="grid grid-cols-3 gap-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <Block key={i} className="aspect-square rounded-none" />
      ))}
    </div>
  </div>
);

export const GridSkeleton = ({
  count = 6,
  cols = 2,
}: { count?: number; cols?: 2 | 3 }) => (
  <div className={`grid gap-3 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="rounded-2xl border border-hairline bg-card overflow-hidden"
      >
        <Block className="aspect-square rounded-none" />
        <div className="p-3 space-y-2">
          <Block className="h-3 w-2/3" />
          <Block className="h-2.5 w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

export const MeetupListSkeleton = ({ count = 4 }: { count?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-2xl border border-hairline bg-card p-4 flex gap-3">
        <Block className="h-16 w-16 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <Block className="h-3.5 w-2/3" />
          <Block className="h-2.5 w-1/2" />
          <Block className="h-2.5 w-1/3" />
        </div>
      </div>
    ))}
  </div>
);
