import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Calendar, ArrowRight } from "lucide-react";

type Pet = { id: string; name: string; species: string; breed: string | null; city: string | null; avatar_url: string | null };
type Meetup = { id: string; title: string; city: string | null; starts_at: string; attending_count: number };

const Explore = () => {
  const [pets, setPets] = useState<Pet[]>([]);
  const [meetups, setMeetups] = useState<Meetup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Explore Petos — pets, meetups & more";
    (async () => {
      const [{ data: p }, { data: m }] = await Promise.all([
        supabase.from("pets").select("id,name,species,breed,city,avatar_url").limit(12),
        supabase.from("meetups").select("id,title,city,starts_at,attending_count").eq("status", "upcoming").order("starts_at").limit(6),
      ]);
      setPets((p as any) || []);
      setMeetups((m as any) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-hairline sticky top-0 bg-background/80 backdrop-blur z-10">
        <div className="container-app flex items-center justify-between h-14">
          <Link to="/" className="font-display text-xl tracking-tight">Petos</Link>
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/auth"><Button size="sm" className="rounded-xl">Join</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container-app py-12 text-center max-w-2xl mx-auto">
        <h1 className="font-display text-4xl sm:text-5xl tracking-tight">A complete digital life for every pet.</h1>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Discover pets in your city, join meetups, find vets, and keep your pet's whole story in one place.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/auth"><Button size="lg" className="rounded-xl h-12 px-6">Create your pet's profile</Button></Link>
        </div>
      </section>

      {loading ? (
        <div className="container-app py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Pets */}
          <section className="container-app py-8">
            <div className="flex items-end justify-between mb-4">
              <h2 className="font-display text-2xl">Pets near you</h2>
              <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                See all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {pets.map((p) => (
                <Link key={p.id} to="/auth" className="group rounded-xl overflow-hidden border border-hairline bg-card">
                  <div className="aspect-square bg-muted overflow-hidden">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">🐾</div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-medium text-sm truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.breed || p.species}{p.city ? ` · ${p.city}` : ""}
                    </div>
                  </div>
                </Link>
              ))}
              {pets.length === 0 && (
                <div className="col-span-full text-sm text-muted-foreground text-center py-8">No public pets yet.</div>
              )}
            </div>
          </section>

          {/* Meetups */}
          <section className="container-app py-8">
            <div className="flex items-end justify-between mb-4">
              <h2 className="font-display text-2xl">Upcoming meetups</h2>
              <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                Join in <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {meetups.map((m) => (
                <Link key={m.id} to="/auth" className="rounded-xl border border-hairline bg-card p-4 hover:border-foreground/30 transition-colors">
                  <div className="font-medium">{m.title}</div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    {m.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{m.city}</span>}
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(m.starts_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                    </span>
                    <span>· {m.attending_count} going</span>
                  </div>
                </Link>
              ))}
              {meetups.length === 0 && (
                <div className="col-span-full text-sm text-muted-foreground text-center py-8">No upcoming meetups.</div>
              )}
            </div>
          </section>
        </>
      )}

      {/* Footer CTA */}
      <section className="container-app py-16 text-center">
        <div className="rounded-2xl border border-hairline bg-card p-8 max-w-xl mx-auto">
          <h3 className="font-display text-2xl">Ready to join?</h3>
          <p className="mt-2 text-sm text-muted-foreground">Create a free account to message owners, RSVP to meetups, and book vets.</p>
          <Link to="/auth"><Button size="lg" className="rounded-xl h-12 px-6 mt-5">Get started</Button></Link>
        </div>
      </section>
    </div>
  );
};

export default Explore;
