import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Clock } from "lucide-react";

const formatTimeAgo = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff} min ago`;
  if (diff < 60 * 24) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / (60 * 24))}d ago`;
};

const MissingFeed = () => {
  const nav = useNavigate();
  const { data: profile } = useProfile();
  const userCity = profile?.city ?? null;

  const { data: items, isLoading } = useQuery({
    queryKey: ["missing-pets", "feed", userCity],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missing_pets")
        .select("id, pet_id, photo_url, last_seen_city, last_seen_at, reward_inr, note, created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const ids = (data ?? []).map((m: any) => m.pet_id);
      let petsMap: Record<string, any> = {};
      if (ids.length) {
        const { data: pets } = await supabase.rpc("get_pets_public");
        petsMap = Object.fromEntries((pets ?? []).filter((p: any) => ids.includes(p.id)).map((p: any) => [p.id, p]));
      }
      return (data ?? []).map((m: any) => ({ ...m, pet: petsMap[m.pet_id] }));
    },
  });

  const local = items?.filter((m) => userCity && m.last_seen_city?.toLowerCase() === userCity.toLowerCase()) ?? [];
  const others = items?.filter((m) => !userCity || m.last_seen_city?.toLowerCase() !== userCity.toLowerCase()) ?? [];

  return (
    <div className="min-h-screen bg-background pad-bottom-safe">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline">
        <div className="container-app h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="font-display text-xl">Missing pets</h1>
        </div>
      </header>

      <main className="container-app py-6 space-y-6">
        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

        {!isLoading && items?.length === 0 && (
          <Card className="rounded-2xl border-hairline p-8 text-center text-sm text-muted-foreground shadow-none">
            No active reports right now. That's a good thing.
          </Card>
        )}

        {local.length > 0 && (
          <Section title={`Near ${userCity}`} count={local.length}>
            {local.map((m) => <MissingCard key={m.id} m={m} />)}
          </Section>
        )}

        {others.length > 0 && (
          <Section title="Other cities" count={others.length}>
            {others.map((m) => <MissingCard key={m.id} m={m} />)}
          </Section>
        )}
      </main>
    </div>
  );
};

const Section = ({ title, count, children }: { title: string; count: number; children: React.ReactNode }) => (
  <div>
    <div className="flex items-center justify-between mb-3 px-1">
      <h2 className="font-display text-lg">{title}</h2>
      <span className="text-xs text-muted-foreground">{count}</span>
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

const MissingCard = ({ m }: { m: any }) => {
  const nav = useNavigate();
  return (
    <Card
      onClick={() => nav(`/missing/${m.id}`)}
      className="rounded-2xl border-hairline shadow-none overflow-hidden cursor-pointer hover:bg-muted/30 transition-colors"
    >
      <div className="flex gap-3 p-3">
        <div className="h-20 w-20 rounded-xl bg-muted overflow-hidden shrink-0">
          {m.photo_url ? <img src={m.photo_url} alt={m.pet?.name ?? "missing pet"} className="h-full w-full object-cover" /> : null}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <div className="font-display text-base truncate">{m.pet?.name ?? "Pet"}</div>
            {m.reward_inr ? (
              <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                ₹{m.reward_inr} reward
              </span>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {m.pet?.species}{m.pet?.breed ? ` · ${m.pet.breed}` : ""}
          </div>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{m.last_seen_city ?? "—"}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatTimeAgo(m.created_at)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default MissingFeed;
