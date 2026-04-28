import { ShieldCheck, ShieldAlert, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Provider = {
  trust_status?: string | null;
  quiz_passed_at?: string | null;
  verified?: boolean | null;
  years_experience?: number | null;
};

/** Compact trust signal shown on provider cards & detail pages. */
export const TrustBadge = ({ provider }: { provider: Provider }) => {
  const verified = provider.verified || provider.trust_status === "verified";
  const quizPassed = !!provider.quiz_passed_at;

  if (verified && quizPassed) {
    return (
      <Badge className="bg-primary text-primary-foreground border-0 gap-1">
        <ShieldCheck className="h-3 w-3" /> Verified + safety trained
      </Badge>
    );
  }
  if (verified) {
    return (
      <Badge className="bg-primary-soft text-primary border-0 gap-1">
        <ShieldCheck className="h-3 w-3" /> ID verified
      </Badge>
    );
  }
  if (quizPassed) {
    return (
      <Badge variant="outline" className="border-hairline gap-1">
        <Shield className="h-3 w-3" /> Safety trained
      </Badge>
    );
  }
  if (provider.trust_status === "pending") {
    return (
      <Badge variant="outline" className="border-hairline gap-1 text-muted-foreground">
        <ShieldAlert className="h-3 w-3" /> Verification pending
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-hairline gap-1 text-muted-foreground">
      <ShieldAlert className="h-3 w-3" /> Unverified
    </Badge>
  );
};