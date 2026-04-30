import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, ArrowRight, Compass, PawPrint, ShieldCheck } from "lucide-react";
import { useSeo } from "@/hooks/useSeo";
import { WizardSteps } from "@/components/onboarding/WizardSteps";

const ORG_TYPES = ["breeder", "kennel", "shelter", "sanctuary", "zoo"];

export default function OnboardingDone() {
  const nav = useNavigate();
  useSeo({ title: "You're all set", description: "Welcome to PetOS." });

  const { data: profile } = useQuery({
    queryKey: ["profile-self"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, account_type, full_name")
        .eq("id", u.user.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: org } = useQuery({
    queryKey: ["org-self"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("org_profiles")
        .select("status")
        .eq("user_id", u.user.id)
        .maybeSingle();
      return data;
    },
  });

  const isOrg = ORG_TYPES.includes(profile?.account_type ?? "");
  const orgPending = isOrg && org?.status === "pending";
  const role = profile?.account_type ?? "pet_parent";

  // Role-aware primary CTA. Drives the user to the most useful first action
  // for their journey (parents → home, buyers → adoption, providers → jobs).
  const primary =
    role === "buyer"
      ? { label: "Browse adoptions", to: "/mates?tab=adopt" }
      : role === "provider"
      ? { label: "Open provider dashboard", to: "/provider" }
      : isOrg
      ? { label: "Go to my dashboard", to: "/" }
      : { label: "Open my pet's home", to: "/" };

  return (
    <div className="container-app pt-4 pb-24 max-w-lg">
      <WizardSteps current={3} labels={["Account type", isOrg ? "Verification" : "Add a pet", "All set"]} />

      <div className="text-center py-6">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 grid place-items-center mb-4">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl mb-1">You're all set!</h1>
        <p className="text-sm text-muted-foreground">
          {profile?.full_name ? `Welcome, ${profile.full_name}.` : "Welcome to PetOS."}
        </p>
      </div>

      {orgPending && (
        <Card className="rounded-2xl p-4 mb-4 border-primary/30 bg-primary/5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium">Verification in review</div>
              <div className="text-muted-foreground mt-0.5">
                Our team is reviewing your documents. You'll get a verified badge on listings once approved.
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground px-1">What's next</p>
        <NextLink to="/discover" Icon={Compass} title="Explore feed" desc="See posts from the community" />
        <NextLink to="/mates" Icon={PawPrint} title="Browse mates & adoption" desc="Find companions or new family members" />
        <NextLink to="/how-it-works" Icon={ArrowRight} title="How PetOS works" desc="Quick visual tour of the platform" />
      </div>

      <Button className="w-full mt-6" onClick={() => nav(primary.to)}>
        {primary.label}
      </Button>
    </div>
  );
}

function NextLink({ to, Icon, title, desc }: { to: string; Icon: any; title: string; desc: string }) {
  return (
    <Link to={to}>
      <Card className="rounded-2xl p-4 flex items-center gap-3 hover:bg-muted/40 transition cursor-pointer">
        <div className="h-10 w-10 rounded-xl bg-muted grid place-items-center">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </Card>
    </Link>
  );
}