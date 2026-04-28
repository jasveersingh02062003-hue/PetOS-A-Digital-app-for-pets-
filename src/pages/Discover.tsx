import { Card } from "@/components/ui/card";
import { Compass, Heart, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const Discover = () => {
  return (
    <div className="container-app pad-top-safe">
      <header className="pt-6 pb-4">
        <h1 className="font-display text-3xl">Discover</h1>
      </header>
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search breeds, pets, services" className="h-12 pl-11 rounded-xl border-hairline bg-card" />
      </div>

      <Section title="Mates nearby" subtitle="Verified, in your city">
        <Card className="rounded-2xl border-hairline bg-card shadow-none p-6 text-center">
          <Heart className="h-6 w-6 mx-auto text-primary mb-2" strokeWidth={1.5} />
          <div className="font-display text-lg">Coming soon</div>
          <p className="text-sm text-muted-foreground mt-1">Verified mating listings will appear here.</p>
        </Card>
      </Section>

      <Section title="Trending" subtitle="From the Petos community">
        <Card className="rounded-2xl border-hairline bg-card shadow-none p-6 text-center">
          <Compass className="h-6 w-6 mx-auto text-primary mb-2" strokeWidth={1.5} />
          <div className="font-display text-lg">No posts yet</div>
          <p className="text-sm text-muted-foreground mt-1">Be the first to share a moment.</p>
        </Card>
      </Section>
    </div>
  );
};

const Section = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <section className="mb-8">
    <div className="mb-3">
      <h2 className="font-display text-xl">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground tracking-wide uppercase mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </section>
);

export default Discover;
