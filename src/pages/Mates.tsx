import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Heart, Plus, Sparkles, ShieldCheck, PawPrint, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { usePets, useProfile } from "@/hooks/useProfile";
import { MatesGrid } from "@/components/MatesGrid";
import { AdoptGrid } from "@/components/AdoptGrid";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSeo } from "@/hooks/useSeo";

const Mates = () => {
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: profile } = useProfile();
  const isBuyer = (profile as any)?.account_type === "buyer";
  const tabParam = searchParams.get("tab");
  // Buyers default to adopt tab unless they explicitly choose mating
  const tab: "mating" | "adopt" =
    tabParam === "adopt" ? "adopt" : tabParam === "mating" ? "mating" : isBuyer ? "adopt" : "mating";
  const setTab = (next: "mating" | "adopt") => {
    const sp = new URLSearchParams(searchParams);
    if (next === "mating") sp.delete("tab"); else sp.set("tab", "adopt");
    setSearchParams(sp, { replace: true });
  };
  const { data: pets } = usePets();
  const myPet = pets?.[0];

  // Auto-redirect first-time buyers to adopt tab in URL too
  useEffect(() => {
    if (isBuyer && tabParam === null) {
      const sp = new URLSearchParams(searchParams);
      sp.set("tab", "adopt");
      setSearchParams(sp, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBuyer]);

  useSeo({
    title: "Find a mate for your pet",
    description: "Verified breeding partners and pet companions near you.",
  });

  return (
    <div className="container-app pad-top-safe">
      <header className="pt-6 pb-4">
        <div className="flex items-center gap-2 text-coral mb-1">
          <Heart className="h-4 w-4" fill="currentColor" />
          <span className="text-[11px] uppercase tracking-[0.18em] font-semibold">Mates</span>
        </div>
        <h1 className="font-display text-[28px] leading-tight">
          {tab === "mating" ? "Find your pet's perfect match" : "Adopt or rehome a pet"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {tab === "mating"
            ? `Verified pets, vaccination-checked, in ${profile?.city || "your city"}.`
            : "Help a pet find a loving family. Always meet in person."}
        </p>
      </header>

      {/* Sub-tabs */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-muted/50 mb-4">
        <button
          onClick={() => setTab("mating")}
          className={`h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition ${tab === "mating" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
        >
          <Heart className="h-4 w-4" /> Mating
        </button>
        <button
          onClick={() => setTab("adopt")}
          className={`h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition ${tab === "adopt" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
        >
          <PawPrint className="h-4 w-4" /> Adopt & Rehome
        </button>
      </div>

      {tab === "mating" ? (
        <MatingPane myPet={myPet} nav={nav} isBuyer={isBuyer} />
      ) : (
        <>
          <button
            onClick={() => nav("/shelters")}
            className="w-full mb-4 rounded-2xl border border-coral/30 bg-gradient-to-r from-coral/10 to-lilac/10 p-3 flex items-center gap-3 text-left hover:shadow-sm transition"
          >
            <div className="h-10 w-10 rounded-xl bg-coral/15 grid place-items-center text-coral shrink-0">
              <Heart className="h-5 w-5" fill="currentColor" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-sm leading-tight">Browse shelters & rescues</div>
              <div className="text-[11px] text-muted-foreground">Adopt, volunteer or donate directly</div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
          <AdoptGrid />
        </>
      )}
    </div>
  );
};

const MatingPane = ({ myPet, nav, isBuyer }: { myPet: any; nav: any; isBuyer: boolean }) => (
  <>
      {/* Your pet hero */}
      {myPet && !isBuyer && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl bg-gradient-to-br from-coral/15 via-card to-lilac/15 border border-coral/20 card-elev p-4 mb-4"
        >
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-2xl overflow-hidden bg-muted shrink-0 ring-2 ring-coral/30">
              {myPet.avatar_url ? (
                <img src={myPet.avatar_url} alt={myPet.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full grid place-items-center font-display text-xl text-coral">{myPet.name?.[0]}</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <div className="font-display text-lg leading-tight truncate">{myPet.name}</div>
                {myPet.vaccination_verified && (
                  <ShieldCheck className="h-4 w-4 text-sky" strokeWidth={2.4} />
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {[myPet.breed, myPet.species].filter(Boolean).join(" · ")}
              </div>
              <div className="text-[11px] text-coral font-semibold mt-0.5">
                {(myPet as any).discoverable_for_mating ? "Discoverable for mating" : "Not yet listed"}
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => nav("/mates/new")}
              className="rounded-full bg-coral text-coral-foreground hover:bg-coral/90 h-9 px-4"
            >
              {(myPet as any).discoverable_for_mating ? "Edit" : "List"}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Why-this-pass cards */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <FeatureChip tone="coral" icon={Heart} title="Verified" />
        <FeatureChip tone="sky" icon={ShieldCheck} title="Vax-checked" />
        <FeatureChip tone="lilac" icon={Sparkles} title="Compatible" />
      </div>

      {!myPet && !isBuyer && (
        <Button
          onClick={() => nav("/onboarding")}
          className="w-full rounded-2xl h-12 mb-4 bg-coral text-coral-foreground hover:bg-coral/90 gap-2"
        >
          <Plus className="h-4 w-4" /> Add your pet to start
        </Button>
      )}
      {!myPet && isBuyer && (
        <Card className="rounded-2xl border-hairline bg-muted/30 shadow-none p-3 mb-4 text-xs text-muted-foreground">
          Browsing studs and dams. Once you have a pet, you can list it here too.
        </Card>
      )}

      <h2 className="font-display text-lg mb-3 mt-2">Browse listings</h2>
      <MatesGrid />
  </>
);

const FeatureChip = ({ icon: Icon, title, tone }: { icon: any; title: string; tone: string }) => {
  const tones: Record<string, string> = {
    coral: "bg-coral/10 text-coral",
    sky: "bg-sky/10 text-sky",
    lilac: "bg-lilac/10 text-lilac",
  };
  return (
    <div className={`rounded-2xl ${tones[tone]} p-3 flex flex-col items-center gap-1.5 text-center`}>
      <Icon className="h-4 w-4" strokeWidth={2.2} />
      <div className="text-[11px] font-semibold">{title}</div>
    </div>
  );
};

export default Mates;
