import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, usePets } from "@/hooks/useProfile";
import { useTier } from "@/hooks/useTier";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, Plus, Wallet, Bookmark, Heart, Stethoscope, ShoppingBag, Package, ShieldCheck, AlertTriangle, Sparkles } from "lucide-react";
import { PetVerifyBadge } from "@/components/PetVerifyBadge";
import { PlusBadge } from "@/components/PlusBadge";
import { MissingCreateSheet } from "@/components/MissingCreateSheet";

const Profile = () => {
  const nav = useNavigate();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { data: pets } = usePets();
  const { data: tier } = useTier();
  const [isStaff, setIsStaff] = useState(false);
  const [reportingPet, setReportingPet] = useState<any | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      const roles = (data ?? []).map((r: any) => r.role);
      setIsStaff(roles.includes("super_admin") || roles.includes("moderator"));
    });
  }, [user]);

  return (
    <div className="container-app pad-top-safe">
      <header className="pt-6 pb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl">Profile</h1>
        <Button variant="ghost" size="icon" className="rounded-full h-10 w-10" onClick={() => nav("/settings")}>
          <Settings className="h-5 w-5" strokeWidth={1.5} />
        </Button>
      </header>

      <Card className="rounded-2xl border-hairline bg-card shadow-none p-5 mb-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary-soft flex items-center justify-center font-display text-2xl text-primary">
            {profile?.full_name?.[0]?.toUpperCase() || "·"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-display text-xl truncate">{profile?.full_name || "—"}</div>
              {tier?.tier === "plus" && <PlusBadge />}
            </div>
            <div className="text-sm text-muted-foreground">{profile?.city || "Set your city"}</div>
          </div>
        </div>
      </Card>

      {tier?.tier !== "plus" && (
        <Card
          onClick={() => nav("/plus")}
          className="rounded-2xl border-hairline bg-primary/5 shadow-none p-4 mb-4 flex items-center gap-3 cursor-pointer hover:bg-primary/10 transition-colors"
        >
          <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-primary" strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">Try Petos Plus</div>
            <div className="text-xs text-muted-foreground">Unlimited AI, 2 vet consults/mo, more</div>
          </div>
          <span className="text-xs text-primary font-medium">See plans</span>
        </Card>
      )}

      <h2 className="font-display text-lg mt-6 mb-3 flex items-center justify-between">
        <span>My pets</span>
        <Button variant="ghost" size="sm" className="text-primary">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </h2>

      <div className="space-y-3 mb-8">
        {pets?.map((p) => (
          <Card key={p.id} className="rounded-2xl border-hairline bg-card shadow-none p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center font-display text-lg overflow-hidden">
                {p.avatar_url ? <img src={p.avatar_url} alt={p.name} className="h-full w-full object-cover" /> : p.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium truncate">{p.name}</div>
                  <PetVerifyBadge petId={p.id} verified={p.vaccination_verified} />
                </div>
                <div className="text-xs text-muted-foreground">{p.breed} · {p.species}</div>
              </div>
            </div>
            <button
              onClick={() => setReportingPet(p)}
              className="mt-3 w-full text-xs text-destructive font-medium border-t border-hairline pt-3 flex items-center justify-center gap-1.5 hover:bg-destructive/5 -mx-4 -mb-4 px-4 pb-3 rounded-b-2xl transition-colors"
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Report missing
            </button>
          </Card>
        ))}
        {(!pets || pets.length === 0) && (
          <Card className="rounded-2xl border-hairline bg-card shadow-none p-6 text-center text-sm text-muted-foreground">
            No pets yet
          </Card>
        )}
      </div>

      <div className="space-y-2 mb-8">
        <Row icon={Heart} label="My mating listings & requests" onClick={() => nav("/mates/manage")} />
        <Row icon={Package} label="My orders" onClick={() => nav("/orders")} />
        <Row icon={ShoppingBag} label="Manage services" onClick={() => nav("/services/manage")} />
        <Row icon={Stethoscope} label="Vet portal" onClick={() => nav("/vet")} />
        {isStaff && <Row icon={ShieldCheck} label="Admin console" onClick={() => nav("/admin")} />}
        <Row icon={Bookmark} label="Saved posts" />
        <Row icon={Wallet} label="Wallet" />
      </div>

      <Button variant="outline" onClick={signOut} className="w-full rounded-xl h-12 border-hairline">
        <LogOut className="h-4 w-4 mr-2" /> Sign out
      </Button>

      <div className="mt-8 pt-6 border-t border-hairline">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Danger zone</div>
        <button
          onClick={() => nav("/account/delete")}
          className="w-full text-left text-sm text-destructive hover:underline flex items-center gap-2"
        >
          <AlertTriangle className="h-4 w-4" /> Delete my account
        </button>
      </div>

      <div className="mt-6 mb-10 flex justify-center gap-4 text-xs text-muted-foreground">
        <a href="/legal/terms" className="hover:text-foreground">Terms</a>
        <a href="/legal/privacy" className="hover:text-foreground">Privacy</a>
        <a href="/legal/refunds" className="hover:text-foreground">Refunds</a>
      </div>

      {reportingPet && (
        <MissingCreateSheet
          open={!!reportingPet}
          onOpenChange={(o) => !o && setReportingPet(null)}
          pet={reportingPet}
        />
      )}
    </div>
  );
};

const Row = ({ icon: Icon, label, onClick }: { icon: any; label: string; onClick?: () => void }) => (
  <Card onClick={onClick} className="rounded-2xl border-hairline bg-card shadow-none p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/40 transition-colors">
    <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
    <span className="text-sm font-medium">{label}</span>
  </Card>
);

export default Profile;
