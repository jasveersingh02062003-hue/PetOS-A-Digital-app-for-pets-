import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, ChevronRight, User, Bell, Phone, Shield, PawPrint, Target,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePets } from "@/hooks/useProfile";

const Settings = () => {
  const nav = useNavigate();
  const { signOut } = useAuth();
  const { data: pets } = usePets();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline">
        <div className="container-app h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="font-display text-xl">Settings</h1>
        </div>
      </header>

      <main className="container-app py-6 space-y-6">
        <Section title="You">
          <Row icon={User} label="About you" desc="Name, city, language, units" onClick={() => nav("/settings/about")} />
          <Row icon={Target} label="Goals & interests" desc="Re-pick what brings you here" onClick={() => nav("/settings/goals")} />
        </Section>

        <Section title="Pets">
          {pets?.length ? pets.map((p) => (
            <Row
              key={p.id}
              icon={PawPrint}
              label={p.name}
              desc={`${p.breed ?? "—"} · ${p.species}`}
              onClick={() => nav(`/settings/pet/${p.id}`)}
            />
          )) : (
            <p className="text-sm text-muted-foreground px-4 py-3">No pets yet.</p>
          )}
        </Section>

        <Section title="Privacy & notifications">
          <Row icon={Bell} label="Notifications" desc="Push, email, SMS" onClick={() => nav("/settings/notifications")} />
          <Row icon={Phone} label="Emergency vet" desc="Used by SOS button" onClick={() => nav("/settings/emergency")} />
          <Row icon={Shield} label="Privacy" desc="Mating discoverability per pet" onClick={() => nav("/settings/privacy")} />
        </Section>

        <Button variant="outline" onClick={signOut} className="w-full rounded-xl h-12 border-hairline">
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </main>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium px-1 mb-2">{title}</div>
    <Card className="rounded-2xl border-hairline shadow-none divide-y divide-hairline overflow-hidden">{children}</Card>
  </div>
);

const Row = ({ icon: Icon, label, desc, onClick }: {
  icon: any; label: string; desc?: string; onClick?: () => void;
}) => (
  <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left">
    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
      <Icon className="h-4 w-4 text-primary" strokeWidth={1.6} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="font-medium text-sm">{label}</div>
      {desc && <div className="text-xs text-muted-foreground truncate">{desc}</div>}
    </div>
    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
  </button>
);

export default Settings;
