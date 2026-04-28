import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PawPrint, Building2, Heart, Home, ShieldHalf, ShieldAlert, Search } from "lucide-react";
import { toast } from "sonner";
import { useSeo } from "@/hooks/useSeo";
import { WizardSteps } from "@/components/onboarding/WizardSteps";

type AccountType = "pet_parent" | "breeder" | "kennel" | "shelter" | "sanctuary" | "zoo" | "rescuer" | "buyer";

const OPTIONS: { value: AccountType; title: string; sub: string; Icon: any; needsOrg: boolean; buyerOnly?: boolean }[] = [
  { value: "buyer", title: "Looking to get a pet", sub: "Browse adoption & breeders, no pet required", Icon: Search, needsOrg: false, buyerOnly: true },
  { value: "pet_parent", title: "Pet parent", sub: "I have pets at home", Icon: PawPrint, needsOrg: false },
  { value: "breeder", title: "Breeder", sub: "I breed pets responsibly", Icon: PawPrint, needsOrg: true },
  { value: "kennel", title: "Kennel / Cattery", sub: "Registered facility", Icon: Building2, needsOrg: true },
  { value: "shelter", title: "Shelter / Rescue NGO", sub: "We rescue and rehome animals", Icon: Home, needsOrg: true },
  { value: "sanctuary", title: "Sanctuary / Gaushala", sub: "Lifelong care for animals", Icon: ShieldHalf, needsOrg: true },
  { value: "rescuer", title: "Independent rescuer", sub: "I rescue animals on my own", Icon: Heart, needsOrg: false },
  { value: "zoo", title: "Zoo / Wildlife centre", sub: "Education and donations only", Icon: ShieldAlert, needsOrg: true },
];

const AccountTypeChooser = () => {
  const nav = useNavigate();
  const qc = useQueryClient();
  useSeo({ title: "Choose your account type", description: "Tell us how you'll use PetOS." });

  const { data: profile } = useQuery({
    queryKey: ["profile-self"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("id, account_type").eq("id", u.user.id).maybeSingle();
      return data;
    },
  });

  const setType = useMutation({
    mutationFn: async (t: AccountType) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").update({ account_type: t }).eq("id", u.user.id);
      if (error) throw error;
      return t;
    },
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["profile-self"] });
      const opt = OPTIONS.find((o) => o.value === t)!;
      if (opt.needsOrg) {
        toast.success("Saved. Continue with verification");
        nav("/onboarding/org");
      } else if (opt.buyerOnly) {
        toast.success("Welcome! Let's tune your search");
        nav("/onboarding/buyer-prefs");
      } else {
        toast.success("Account type saved");
        nav("/onboarding/add-pet");
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });

  return (
    <div className="container-app pt-4 pb-24 max-w-lg">
      <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <WizardSteps current={1} />
      <h1 className="font-display text-2xl mb-1">How will you use PetOS?</h1>
      <p className="text-sm text-muted-foreground mb-5">You can change this later in Settings.</p>

      <div className="space-y-2">
        {OPTIONS.map((o) => {
          const Icon = o.Icon;
          const active = profile?.account_type === o.value;
          return (
            <Card
              key={o.value}
              onClick={() => setType.mutate(o.value)}
              className={`rounded-2xl border p-4 cursor-pointer transition ${active ? "border-primary bg-primary/5" : "border-hairline hover:border-foreground/20"}`}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-muted grid place-items-center">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{o.title}</div>
                  <div className="text-xs text-muted-foreground">{o.sub}</div>
                </div>
                {o.needsOrg && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Verify</span>}
              </div>
            </Card>
          );
        })}
      </div>

      <Button variant="ghost" onClick={() => nav("/")} className="w-full mt-4 text-muted-foreground">
        Skip for now
      </Button>
    </div>
  );
};

export default AccountTypeChooser;