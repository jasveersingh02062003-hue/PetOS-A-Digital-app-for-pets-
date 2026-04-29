import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, ChevronRight, User, Bell, Phone, Shield, PawPrint, Target,
  LogOut, CreditCard, UserX, Crown, Globe, Moon, HelpCircle, FileText,
  Sparkles, Mail, Trash2, Repeat, Baby,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePets, useProfile } from "@/hooks/useProfile";
import { useTier } from "@/hooks/useTier";

const Settings = () => {
  const nav = useNavigate();
  const { signOut, user } = useAuth();
  const { data: profile } = useProfile();
  const { data: pets } = usePets();
  const { data: tier } = useTier();
  const isPlus = tier?.tier === "plus";

  const initials = (profile?.full_name || user?.email || "U")
    .split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-hairline">
        <div className="container-app h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="font-display text-xl">Settings</h1>
        </div>
      </header>

      <main className="container-app py-6 space-y-6">
        {/* Identity card */}
        <Card className="rounded-2xl border-hairline shadow-none p-4 flex items-center gap-3">
          <Avatar className="h-14 w-14 ring-2 ring-primary/15">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-display text-base truncate">{profile?.full_name || "Your account"}</div>
              {isPlus && (
                <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 border-0 gap-1">
                  <Crown className="h-3 w-3" /> Plus
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <Mail className="h-3 w-3" /> {user?.email}
            </div>
          </div>
          <Button variant="ghost" size="sm" className="rounded-full" onClick={() => nav("/settings/about")}>
            Edit
          </Button>
        </Card>

        {!isPlus && (
          <button
            onClick={() => nav("/plus")}
            className="w-full text-left rounded-2xl p-4 bg-gradient-to-br from-amber-400/15 via-coral/10 to-lilac/15 border border-amber-400/20 flex items-center gap-3"
          >
            <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-amber-700" />
            </div>
            <div className="flex-1">
              <div className="font-display text-sm">Upgrade to Petos Plus</div>
              <div className="text-xs text-muted-foreground">AI vet, priority bookings & more</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        )}

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
          <Row icon={UserX} label="Blocked accounts" desc="People you've blocked" onClick={() => nav("/settings/blocked")} />
        </Section>

        <Section title="Plan">
          <Row icon={CreditCard} label="Billing & subscription" desc="Manage Petos Plus" onClick={() => nav("/settings/billing")} />
        </Section>

        <Section title="Bookings">
          <Row icon={Repeat} label="Recurring bookings" desc="Pause, resume or cancel schedules" onClick={() => nav("/bookings/recurring")} />
          <Row icon={Baby} label="Pregnancies" desc="Track gestation and whelping reminders" onClick={() => nav("/pregnancies")} />
          <Row icon={Bell} label="Shop reminders" desc="Reorder food, litter & meds on time" onClick={() => nav("/shop/reminders")} />
        </Section>

        <Section title="App">
          <Row icon={Globe} label="Language & region" desc="English · Metric" onClick={() => nav("/settings/about")} />
          <Row icon={Moon} label="Appearance" desc="System default" onClick={() => nav("/settings/about")} />
        </Section>

        <Section title="Support">
          <Row icon={HelpCircle} label="Help center" desc="FAQs and guides" onClick={() => nav("/help")} />
          <Row icon={FileText} label="Terms & privacy" onClick={() => nav("/legal")} />
        </Section>

        <div className="space-y-2 pt-2">
          <Button variant="outline" onClick={signOut} className="w-full rounded-xl h-12 border-hairline">
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
          <Button
            variant="ghost"
            onClick={() => nav("/settings/delete-account")}
            className="w-full rounded-xl h-11 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete account
          </Button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground pt-2">Petos · v1.0.0</p>
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
