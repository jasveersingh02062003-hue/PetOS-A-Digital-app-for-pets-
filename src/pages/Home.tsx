import { useNavigate } from "react-router-dom";
import { useProfile, usePets } from "@/hooks/useProfile";
import { ComposerButton } from "@/components/Composer";
import { PostFeed } from "@/components/PostFeed";
import { MissingStrip } from "@/components/MissingStrip";
import { DailyTipCard } from "@/components/DailyTipCard";
import { EmptyState } from "@/components/EmptyState";
import { Heart, Plus } from "lucide-react";

const Home = () => {
  const nav = useNavigate();
  const { data: profile } = useProfile();
  const { data: pets } = usePets();
  const firstName = profile?.full_name?.split(" ")[0];
  const hasPets = !!pets && pets.length > 0;

  return (
    <div className="container-app pad-top-safe">
      <header className="pt-6 pb-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{new Date().toLocaleDateString(undefined, { weekday: "long" })}</div>
          <h1 className="font-display text-3xl mt-1">Hello{firstName ? `, ${firstName}` : ""}</h1>
        </div>
        <ComposerButton variant="icon" />
      </header>

      {/* Stories rail */}
      {hasPets && (
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 py-3">
          {pets!.map((p) => (
            <button
              key={p.id}
              onClick={() => nav(`/health/${p.id}/timeline`)}
              className="flex flex-col items-center gap-1.5 shrink-0"
            >
              <div className="h-16 w-16 rounded-full ring-2 ring-primary/30 ring-offset-2 ring-offset-background bg-muted overflow-hidden flex items-center justify-center">
                {p.avatar_url ? <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" /> : <span className="font-display text-xl text-ink-soft">{p.name[0]}</span>}
              </div>
              <span className="text-[11px] text-muted-foreground max-w-[64px] truncate">{p.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 mb-3">
        <MissingStrip />
      </div>

      {/* Daily care tip — seeded so the home is never empty */}
      <div className="mt-2 mb-4">
        <DailyTipCard />
      </div>

      <div className="mt-3 mb-4">
        <ComposerButton variant="inline" />
      </div>

      <section className="pb-10">
        <h2 className="font-display text-xl mb-3">Feed</h2>
        <PostFeed
          scope="all"
          emptyState={
            <EmptyState
              icon={Heart}
              title="Your feed starts with a moment"
              description={
                hasPets
                  ? `Share ${pets![0].name}'s day — a photo, a milestone, or a question. Other pet parents will see it.`
                  : "Add your first pet to start sharing photos and following other pets nearby."
              }
              ctaLabel={hasPets ? "Share a moment" : "Add your first pet"}
              onCta={() => nav(hasPets ? "/" : "/onboarding")}
              secondaryLabel="Explore Discover"
              onSecondary={() => nav("/discover")}
            />
          }
        />
      </section>

      <ComposerButton variant="fab" />
    </div>
  );
};

export default Home;
