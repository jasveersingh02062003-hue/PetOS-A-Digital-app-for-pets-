import { Badge } from "@/components/ui/badge";
import { BadgeCheck, PawPrint, Building2, Heart, Home, ShieldHalf, ShieldAlert, Search, Clock } from "lucide-react";

type AccountType = "pet_parent" | "breeder" | "kennel" | "shelter" | "sanctuary" | "zoo" | "rescuer" | "buyer";

const META: Record<AccountType, { label: string; tone: string; Icon: any }> = {
  pet_parent: { label: "Pet parent", tone: "bg-muted text-foreground border-hairline", Icon: PawPrint },
  breeder: { label: "Breeder", tone: "bg-amber-500/15 text-amber-700 border-amber-500/30", Icon: PawPrint },
  kennel: { label: "Kennel", tone: "bg-sky/15 text-sky border-sky/30", Icon: Building2 },
  shelter: { label: "Shelter / NGO", tone: "bg-lilac/15 text-lilac border-lilac/30", Icon: Home },
  sanctuary: { label: "Sanctuary / Gaushala", tone: "bg-leaf/15 text-leaf border-leaf/30", Icon: ShieldHalf },
  zoo: { label: "Zoo / Wildlife", tone: "bg-stone-500/15 text-stone-700 border-stone-500/30", Icon: ShieldAlert },
  rescuer: { label: "Rescuer", tone: "bg-coral/15 text-coral border-coral/30", Icon: Heart },
  buyer: { label: "Looking for a pet", tone: "bg-primary/10 text-primary border-primary/30", Icon: Search },
};

export const SellerBadge = ({
  type,
  verified,
  pending,
  className,
}: { type?: AccountType | null; verified?: boolean; pending?: boolean; className?: string }) => {
  const t = (type ?? "pet_parent") as AccountType;
  const m = META[t];
  const Icon = m.Icon;
  return (
    <Badge className={`border ${m.tone} gap-1 font-normal ${className ?? ""}`}>
      <Icon className="h-3 w-3" />
      {m.label}
      {verified && t !== "pet_parent" && t !== "buyer" && (
        <BadgeCheck className="h-3 w-3 text-leaf" />
      )}
      {!verified && pending && t !== "pet_parent" && t !== "buyer" && (
        <span className="ml-1 inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-700 bg-amber-100 border border-amber-300 rounded-full px-1.5 py-0.5">
          <Clock className="h-2.5 w-2.5" /> KYC pending
        </span>
      )}
    </Badge>
  );
};