import { Badge } from "@/components/ui/badge";
import { BadgeCheck, PawPrint, Building2, Heart, Home, ShieldHalf, ShieldAlert } from "lucide-react";

type AccountType = "pet_parent" | "breeder" | "kennel" | "shelter" | "sanctuary" | "zoo" | "rescuer";

const META: Record<AccountType, { label: string; tone: string; Icon: any }> = {
  pet_parent: { label: "Pet parent", tone: "bg-muted text-foreground border-hairline", Icon: PawPrint },
  breeder: { label: "Breeder", tone: "bg-amber-500/15 text-amber-700 border-amber-500/30", Icon: PawPrint },
  kennel: { label: "Kennel", tone: "bg-sky/15 text-sky border-sky/30", Icon: Building2 },
  shelter: { label: "Shelter / NGO", tone: "bg-lilac/15 text-lilac border-lilac/30", Icon: Home },
  sanctuary: { label: "Sanctuary / Gaushala", tone: "bg-leaf/15 text-leaf border-leaf/30", Icon: ShieldHalf },
  zoo: { label: "Zoo / Wildlife", tone: "bg-stone-500/15 text-stone-700 border-stone-500/30", Icon: ShieldAlert },
  rescuer: { label: "Rescuer", tone: "bg-coral/15 text-coral border-coral/30", Icon: Heart },
};

export const SellerBadge = ({
  type,
  verified,
  className,
}: { type?: AccountType | null; verified?: boolean; className?: string }) => {
  const t = (type ?? "pet_parent") as AccountType;
  const m = META[t];
  const Icon = m.Icon;
  return (
    <Badge className={`border ${m.tone} gap-1 font-normal ${className ?? ""}`}>
      <Icon className="h-3 w-3" />
      {m.label}
      {verified && (t === "breeder" || t === "kennel") && (
        <BadgeCheck className="h-3 w-3 text-leaf" />
      )}
    </Badge>
  );
};