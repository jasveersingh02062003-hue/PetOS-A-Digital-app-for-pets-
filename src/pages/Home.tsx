import { useProfile, usePets } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Sparkles, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

const Home = () => {
  const { data: profile } = useProfile();
  const { data: pets } = usePets();
  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <div className="container-app pad-top-safe">
      <header className="pt-6 pb-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{new Date().toLocaleDateString(undefined, { weekday: "long" })}</div>
          <h1 className="font-display text-3xl mt-1">Hello{firstName ? `, ${firstName}` : ""}</h1>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full h-11 w-11 border border-hairline">
          <Camera className="h-5 w-5" strokeWidth={1.6} />
        </Button>
      </header>

      {/* Stories rail placeholder */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 py-3">
        {(pets ?? []).map((p) => (
          <div key={p.id} className="flex flex-col items-center gap-1.5 shrink-0">
            <div className="h-16 w-16 rounded-full ring-2 ring-primary/30 ring-offset-2 ring-offset-background bg-muted overflow-hidden flex items-center justify-center">
              {p.avatar_url ? <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" /> : <span className="font-display text-xl text-ink-soft">{p.name[0]}</span>}
            </div>
            <span className="text-[11px] text-muted-foreground max-w-[64px] truncate">{p.name}</span>
          </div>
        ))}
        {(!pets || pets.length === 0) && (
          <div className="flex items-center justify-center text-sm text-muted-foreground py-6">No pets yet</div>
        )}
      </div>

      <Card className="mt-4 p-6 rounded-2xl border-hairline bg-card shadow-none">
        <div className="flex items-start gap-3">
          <div className="bg-primary-soft rounded-full p-2.5">
            <Sparkles className="h-4 w-4 text-primary" strokeWidth={1.75} />
          </div>
          <div className="flex-1">
            <div className="font-display text-lg leading-tight">Your feed is being prepared</div>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Follow other pets, post a moment, or browse Discover to see what's happening in your city.
            </p>
          </div>
        </div>
      </Card>

      <section className="mt-8">
        <h2 className="font-display text-xl mb-3">Today</h2>
        <Card className="rounded-2xl border-hairline bg-card shadow-none p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Reminder</div>
          <div className="font-medium">Add today's meal in the nutrition log</div>
          <div className="text-sm text-muted-foreground mt-1">Helps the AI assistant give better advice.</div>
        </Card>
      </section>
    </div>
  );
};

export default Home;
