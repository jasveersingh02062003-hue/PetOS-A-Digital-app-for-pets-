import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, usePets } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, Plus, Wallet, Bookmark, Heart } from "lucide-react";

const Profile = () => {
  const nav = useNavigate();
  const { signOut } = useAuth();
  const { data: profile } = useProfile();
  const { data: pets } = usePets();

  return (
    <div className="container-app pad-top-safe">
      <header className="pt-6 pb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl">Profile</h1>
        <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
          <Settings className="h-5 w-5" strokeWidth={1.5} />
        </Button>
      </header>

      <Card className="rounded-2xl border-hairline bg-card shadow-none p-5 mb-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary-soft flex items-center justify-center font-display text-2xl text-primary">
            {profile?.full_name?.[0]?.toUpperCase() || "·"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-xl truncate">{profile?.full_name || "—"}</div>
            <div className="text-sm text-muted-foreground">{profile?.city || "Set your city"}</div>
          </div>
        </div>
      </Card>

      <h2 className="font-display text-lg mt-6 mb-3 flex items-center justify-between">
        <span>My pets</span>
        <Button variant="ghost" size="sm" className="text-primary">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </h2>

      <div className="space-y-3 mb-8">
        {pets?.map((p) => (
          <Card key={p.id} className="rounded-2xl border-hairline bg-card shadow-none p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center font-display text-lg">
              {p.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.breed} · {p.species}</div>
            </div>
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
        <Row icon={Bookmark} label="Saved posts" />
        <Row icon={Wallet} label="Wallet" />
      </div>

      <Button variant="outline" onClick={signOut} className="w-full rounded-xl h-12 border-hairline">
        <LogOut className="h-4 w-4 mr-2" /> Sign out
      </Button>
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
